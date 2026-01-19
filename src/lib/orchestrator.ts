/**
 * Analysis Module Orchestrator
 * Manages execution flow, parallelization, and HITL checkpoints
 */

import { nanoid } from 'nanoid';
import type {
  Analysis,
  AnalysisModule,
  ModuleType,
  ModuleStatus,
} from '../types/database.js';
import type { ModuleExecutionContext, ModuleResult } from '../types/modules.js';
import {
  getAnalysis,
  updateAnalysisStatus,
  getAnalysisModules,
  createModule,
  updateModuleStatus,
  createHITLCheckpoint,
  deductCredits,
  storeEvidence,
} from './supabase.js';
import { runChildAgents } from './agents/runner.js';
import { synthesizeModule, synthesizeGlobal } from './agents/synthesis.js';
import type { ModuleSynthesisResult } from './agents/types.js';
import { getMemorySummary, storeMemorySummary } from './agents/memory.js';

// Module dependencies - which modules must complete before others can run
const MODULE_DEPENDENCIES: Record<ModuleType, ModuleType[]> = {
  market_demand: [],
  revenue_intelligence: [],
  competitive_intelligence: [],
  social_sentiment: [],
  linkedin_contacts: [],
  google_maps: [],
  operational_feasibility: [],
  // Dependent modules
  financial_modeling: ['market_demand'], // OR revenue_intelligence
  risk_assessment: ['market_demand', 'competitive_intelligence'],
};

// Modules that can run in parallel (no dependencies on each other)
const PARALLEL_MODULES: ModuleType[] = [
  'market_demand',
  'revenue_intelligence',
  'competitive_intelligence',
  'social_sentiment',
  'linkedin_contacts',
  'google_maps',
  'operational_feasibility',
];

// Module cost estimates (in credits)
const MODULE_COSTS: Record<ModuleType, number> = {
  market_demand: 15,
  revenue_intelligence: 20,
  competitive_intelligence: 25,
  social_sentiment: 10, // base cost, multiplied by platforms selected
  linkedin_contacts: 12,
  google_maps: 12,
  financial_modeling: 10,
  risk_assessment: 10,
  operational_feasibility: 15,
};

export interface OrchestratorOptions {
  enableHITL?: boolean;
  parallelExecution?: boolean;
  maxConcurrentModules?: number;
}

export class AnalysisOrchestrator {
  private analysisId: string;
  private analysis: Analysis | null = null;
  private modules: Map<string, AnalysisModule> = new Map();
  private options: Required<OrchestratorOptions>;
  private totalCost: number = 0;

  constructor(analysisId: string, options: OrchestratorOptions = {}) {
    this.analysisId = analysisId;
    this.options = {
      enableHITL: options.enableHITL ?? true,
      parallelExecution: options.parallelExecution ?? true,
      maxConcurrentModules: options.maxConcurrentModules ?? 4,
    };
  }

  /**
   * Initialize the orchestrator by loading analysis and creating module records
   */
  async initialize(): Promise<boolean> {
    this.analysis = await getAnalysis(this.analysisId);
    if (!this.analysis) {
      console.error(`Analysis not found: ${this.analysisId}`);
      return false;
    }

    // Load existing modules or create new ones
    const existingModules = await getAnalysisModules(this.analysisId);

    for (const mod of existingModules) {
      this.modules.set(mod.module_type, mod);
    }

    // Create modules for any selected modules that don't exist yet
    for (const moduleType of this.analysis.modules) {
      if (!this.modules.has(moduleType)) {
        const newModule = await createModule({
          analysis_id: this.analysisId,
          module_type: moduleType,
          status: 'pending',
          progress: 0,
          started_at: null,
          completed_at: null,
          cost: 0,
          data: null,
          error: null,
        });
        if (newModule) {
          this.modules.set(moduleType, newModule);
        }
      }
    }

    return true;
  }

  /**
   * Estimate total cost for the analysis
   */
  estimateCost(): number {
    if (!this.analysis) return 0;

    let cost = 0;
    for (const moduleType of this.analysis.modules) {
      cost += MODULE_COSTS[moduleType] || 0;
    }

    // Add cost per social platform if social sentiment is selected
    if (
      this.analysis.modules.includes('social_sentiment') &&
      this.analysis.social_platforms
    ) {
      cost += (this.analysis.social_platforms.length - 1) * 3; // Base + 3 per additional platform
    }

    return cost;
  }

  /**
   * Check if all dependencies for a module are satisfied
   */
  private canExecuteModule(moduleType: ModuleType): boolean {
    const deps = MODULE_DEPENDENCIES[moduleType];
    if (deps.length === 0) return true;

    // Special case for financial_modeling: needs market_demand OR revenue_intelligence
    if (moduleType === 'financial_modeling') {
      const hasMarket = this.getModuleStatus('market_demand') === 'completed';
      const hasRevenue = this.getModuleStatus('revenue_intelligence') === 'completed';
      return hasMarket || hasRevenue;
    }

    // All dependencies must be completed
    return deps.every((dep) => {
      const depModule = this.modules.get(dep);
      return depModule && depModule.status === 'completed';
    });
  }

  /**
   * Get the status of a specific module
   */
  private getModuleStatus(moduleType: ModuleType): ModuleStatus | null {
    const mod = this.modules.get(moduleType);
    return mod?.status ?? null;
  }

  /**
   * Get modules that are ready to execute
   */
  getReadyModules(): ModuleType[] {
    if (!this.analysis) {
      console.log('getReadyModules: no analysis');
      return [];
    }

    console.log('getReadyModules: analysis.modules =', this.analysis.modules);
    console.log('getReadyModules: this.modules map =', Array.from(this.modules.entries()));

    return this.analysis.modules.filter((moduleType) => {
      const status = this.getModuleStatus(moduleType);
      const canExecute = this.canExecuteModule(moduleType);
      console.log(`getReadyModules: ${moduleType} status=${status} canExecute=${canExecute}`);
      return (
        (status === 'pending' || status === 'revision_requested') &&
        canExecute
      );
    });
  }

  /**
   * Execute a single module
   */
  async executeModule(
    moduleType: ModuleType,
    executor: (context: ModuleExecutionContext) => Promise<ModuleResult<unknown>>
  ): Promise<boolean> {
    if (!this.analysis) return false;

    const module = this.modules.get(moduleType);
    if (!module) {
      console.error(`Module not found: ${moduleType}`);
      return false;
    }

    // Mark module as running
    await updateModuleStatus(module.id, 'running', 0);

    try {
      const priorModuleData = this.collectPriorModuleData(moduleType);
      const analysisMemory = await getMemorySummary(this.analysisId, 'analysis');

      // Run child agents (specialists) before module execution
      const agentResults = await runChildAgents(moduleType, {
        analysis_id: this.analysisId,
        module_id: module.id,
        module_type: moduleType,
        company_name: this.analysis.company_name,
        product_name: this.analysis.product_name,
        description: this.analysis.description,
        target_market: this.analysis.target_markets?.[0] ?? null,
        social_platforms: this.analysis.social_platforms ?? undefined,
        prior_module_data: priorModuleData,
      });
      const agentResultsForContext: Array<Record<string, unknown>> = agentResults.map((result) => ({
        ...result,
      }));

      const baseContext: ModuleExecutionContext = {
        analysis_id: this.analysisId,
        module_id: module.id,
        company_name: this.analysis.company_name,
        product_name: this.analysis.product_name,
        description: this.analysis.description,
        target_market: this.analysis.target_markets?.[0] ?? null,
        social_platforms: this.analysis.social_platforms ?? undefined,
        prior_module_data: priorModuleData,
        analysis_memory: analysisMemory ?? undefined,
        agent_results: agentResultsForContext,
      };

      // Execute the module
      const result = await executor(baseContext);

      if (result.success) {
        const baseData =
          typeof result.data === 'object' && result.data !== null
            ? (result.data as Record<string, unknown>)
            : { value: result.data };

        let moduleSynthesis: ModuleSynthesisResult | null = null;
        if (agentResults.length > 0) {
          moduleSynthesis = await synthesizeModule(moduleType, baseData, agentResults);
        }

        const moduleData: Record<string, unknown> = {
          ...baseData,
          agent_results: agentResultsForContext,
          module_synthesis: moduleSynthesis,
        };

        // Update module with results
        await updateModuleStatus(
          module.id,
          this.options.enableHITL ? 'hitl_pending' : 'completed',
          100,
          moduleData
        );

        // Track cost
        this.totalCost += result.cost;
        this.totalCost += agentResults.reduce((sum, item) => sum + item.cost, 0);
        if (moduleSynthesis) {
          this.totalCost += moduleSynthesis.cost;
        }

        // Create HITL checkpoint if enabled
        if (this.options.enableHITL) {
          await createHITLCheckpoint({
            analysis_id: this.analysisId,
            module_id: module.id,
            module_type: moduleType,
            status: 'pending',
            data_snapshot: moduleData,
            reviewer_id: null,
            reviewer_comment: null,
            action: null,
            adjustments: null,
          });

          // Update analysis status to hitl_pending
          await updateAnalysisStatus(this.analysisId, 'hitl_pending');
        }

        // Refresh module data
        module.status = this.options.enableHITL ? 'hitl_pending' : 'completed';
        module.data = moduleData;

        if (moduleSynthesis?.summary) {
          await storeMemorySummary({
            analysisId: this.analysisId,
            moduleId: module.id,
            scope: 'analysis',
            summary: moduleSynthesis.summary,
          });
        }

        return true;
      } else {
        await updateModuleStatus(module.id, 'failed', 0, undefined, result.error ?? 'Unknown error');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updateModuleStatus(module.id, 'failed', 0, undefined, errorMessage);
      return false;
    }
  }

  /**
   * Collect data from completed prior modules for dependent modules
   */
  private collectPriorModuleData(
    moduleType: ModuleType
  ): Record<string, unknown> {
    const priorData: Record<string, unknown> = {};
    const deps = MODULE_DEPENDENCIES[moduleType];

    for (const dep of deps) {
      const depModule = this.modules.get(dep);
      if (depModule?.data) {
        priorData[dep] = depModule.data;
      }
    }

    // For dependent modules, also include any available parallel module data
    if (
      moduleType === 'financial_modeling' ||
      moduleType === 'risk_assessment'
    ) {
      for (const parallelType of PARALLEL_MODULES) {
        const parallelModule = this.modules.get(parallelType);
        if (parallelModule?.data && !priorData[parallelType]) {
          priorData[parallelType] = parallelModule.data;
        }
      }
    }

    return priorData;
  }

  /**
   * Update overall analysis progress based on module completion
   */
  async updateProgress(): Promise<number> {
    if (!this.analysis) return 0;

    const totalModules = this.analysis.modules.length;
    if (totalModules === 0) return 100;

    let completedWeight = 0;
    let inProgressWeight = 0;

    for (const moduleType of this.analysis.modules) {
      const mod = this.modules.get(moduleType);
      if (!mod) continue;

      if (mod.status === 'completed' || mod.status === 'approved') {
        completedWeight += 1;
      } else if (mod.status === 'running') {
        inProgressWeight += (mod.progress / 100) * 1;
      } else if (mod.status === 'hitl_pending') {
        completedWeight += 0.9; // Count as 90% complete if awaiting HITL
      }
    }

    const progress = Math.round(
      ((completedWeight + inProgressWeight) / totalModules) * 100
    );

    await updateAnalysisStatus(this.analysisId, 'running', progress);
    return progress;
  }

  /**
   * Check if analysis is complete
   */
  isComplete(): boolean {
    if (!this.analysis) return false;

    return this.analysis.modules.every((moduleType) => {
      const status = this.getModuleStatus(moduleType);
      return status === 'completed' || status === 'approved' || status === 'skipped';
    });
  }

  /**
   * Check if analysis is blocked waiting for HITL
   */
  isAwaitingHITL(): boolean {
    if (!this.analysis) return false;

    return this.analysis.modules.some((moduleType) => {
      return this.getModuleStatus(moduleType) === 'hitl_pending';
    });
  }

  /**
   * Mark analysis as complete and deduct credits
   */
  async finalize(): Promise<boolean> {
    if (!this.analysis) return false;

    const moduleSummaries: Array<{ module: ModuleType; synthesis: ModuleSynthesisResult }> = [];
    for (const moduleType of this.analysis.modules) {
      const mod = this.modules.get(moduleType);
      const synthesis = mod?.data?.module_synthesis as ModuleSynthesisResult | undefined;
      if (synthesis) {
        moduleSummaries.push({ module: moduleType, synthesis });
      }
    }

    if (moduleSummaries.length > 0) {
      const globalSynthesis = await synthesizeGlobal(this.analysis, moduleSummaries);
      const firstModuleId = this.modules.get(moduleSummaries[0].module)?.id;
      if (firstModuleId) {
        await storeEvidence({
          analysis_id: this.analysisId,
          module_id: firstModuleId,
          source_url: 'global-synthesis',
          source_type: 'api_response',
          content_type: 'application/json',
          storage_path: `analyses/${this.analysisId}/global-synthesis.json`,
          metadata: {
            summary: globalSynthesis.executive_summary,
            go_no_go: globalSynthesis.go_no_go,
            citations: globalSynthesis.citations,
            global_synthesis: globalSynthesis,
          },
        });
      }
      this.totalCost += globalSynthesis.cost;
    }

    // Deduct credits
    const success = await deductCredits(
      this.analysis.user_id,
      this.totalCost,
      this.analysisId,
      `Analysis: ${this.analysis.name}`
    );

    if (!success) {
      console.error('Failed to deduct credits');
    }

    // Mark analysis as complete
    await updateAnalysisStatus(this.analysisId, 'completed');
    return true;
  }

  /**
   * Get analysis summary
   */
  getSummary(): {
    id: string;
    status: string;
    progress: number;
    modules: Array<{ type: ModuleType; status: ModuleStatus }>;
    totalCost: number;
    awaitingHITL: boolean;
  } | null {
    if (!this.analysis) return null;

    return {
      id: this.analysisId,
      status: this.analysis.status,
      progress: this.analysis.progress,
      modules: this.analysis.modules.map((type) => ({
        type,
        status: this.getModuleStatus(type) ?? 'pending',
      })),
      totalCost: this.totalCost,
      awaitingHITL: this.isAwaitingHITL(),
    };
  }
}

/**
 * Create and initialize an orchestrator for an analysis
 */
export async function createOrchestrator(
  analysisId: string,
  options?: OrchestratorOptions
): Promise<AnalysisOrchestrator | null> {
  const orchestrator = new AnalysisOrchestrator(analysisId, options);
  const initialized = await orchestrator.initialize();
  return initialized ? orchestrator : null;
}
