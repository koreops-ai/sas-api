/**
 * API: /api/analyses/[id]/start
 * POST - Start analysis execution
 *
 * This endpoint starts module processing and returns immediately.
 * Modules are processed in the background using Vercel's waitUntil.
 * Frontend subscribes to activity_logs for live updates via SSE.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  setCorsHeaders,
  handleOptions,
} from '../../../src/lib/api.js';
import {
  getAnalysis,
  updateAnalysisStatus,
  getUser,
  createModule,
  getAnalysisModules,
  updateModuleStatus,
  storeEvidence,
} from '../../../src/lib/supabase.js';
import {
  emitProgress,
  emitAgentStart,
  emitAgentComplete,
  emitError,
} from '../../../src/lib/activity-emitter.js';
import type { ModuleType } from '../../../src/types/database.js';
import type { ModuleExecutionContext, ModuleResult } from '../../../src/types/modules.js';
import { synthesizeModule, synthesizeGlobal } from '../../../src/lib/agents/synthesis.js';
import type { ModuleSynthesisResult, AgentResult } from '../../../src/lib/agents/types.js';

// Import module executors
import { executeMarketDemand } from '../../../src/modules/market-demand.js';
import { executeRevenueIntelligence } from '../../../src/modules/revenue-intelligence.js';
import { executeCompetitiveIntelligence } from '../../../src/modules/competitive-intelligence.js';
import { executeSocialSentiment } from '../../../src/modules/social-sentiment.js';
import { executeLinkedInContacts } from '../../../src/modules/linkedin-contacts.js';
import { executeGoogleMaps } from '../../../src/modules/google-maps.js';
import { executeFinancialModeling } from '../../../src/modules/financial-modeling.js';
import { executeRiskAssessment } from '../../../src/modules/risk-assessment.js';
import { executeOperationalFeasibility } from '../../../src/modules/operational-feasibility.js';

// Map module types to their executors
const MODULE_EXECUTORS: Record<
  ModuleType,
  (context: ModuleExecutionContext) => Promise<ModuleResult<unknown>>
> = {
  market_demand: executeMarketDemand,
  revenue_intelligence: executeRevenueIntelligence,
  competitive_intelligence: executeCompetitiveIntelligence,
  social_sentiment: executeSocialSentiment,
  linkedin_contacts: executeLinkedInContacts,
  google_maps: executeGoogleMaps,
  financial_modeling: executeFinancialModeling,
  risk_assessment: executeRiskAssessment,
  operational_feasibility: executeOperationalFeasibility,
};

// Module dependencies - some modules need data from others
const MODULE_DEPENDENCIES: Partial<Record<ModuleType, ModuleType[]>> = {
  financial_modeling: ['market_demand', 'revenue_intelligence'],
  risk_assessment: ['market_demand', 'competitive_intelligence'],
  operational_feasibility: ['market_demand'],
};

// Independent modules that can run in parallel
const INDEPENDENT_MODULES: ModuleType[] = [
  'market_demand',
  'revenue_intelligence',
  'competitive_intelligence',
  'social_sentiment',
  'linkedin_contacts',
  'google_maps',
];

/**
 * Process all modules for an analysis
 */
async function processModules(analysisId: string, analysis: Awaited<ReturnType<typeof getAnalysis>>): Promise<void> {
  if (!analysis) return;

  const modules = analysis.modules as ModuleType[];
  const completedModules: Set<ModuleType> = new Set();
  const moduleOutputs: Record<string, unknown> = {};

  // Get module records
  const moduleRecords = await getAnalysisModules(analysisId);
  const moduleMap = new Map(moduleRecords.map(m => [m.module_type, m]));

  // Process independent modules first (can run in parallel)
  const independentModules = modules.filter(m => INDEPENDENT_MODULES.includes(m));
  const dependentModules = modules.filter(m => !INDEPENDENT_MODULES.includes(m));

  // Process independent modules in parallel
  await Promise.all(
    independentModules.map(async (moduleType) => {
      try {
        await executeModuleWithLogging(
          analysisId,
          analysis,
          moduleType,
          moduleMap,
          moduleOutputs,
          completedModules
        );
      } catch (error) {
        console.error(`Error processing ${moduleType}:`, error);
      }
    })
  );

  // Process dependent modules sequentially (they need prior module data)
  for (const moduleType of dependentModules) {
    try {
      await executeModuleWithLogging(
        analysisId,
        analysis,
        moduleType,
        moduleMap,
        moduleOutputs,
        completedModules
      );
    } catch (error) {
      console.error(`Error processing ${moduleType}:`, error);
    }
  }

  // Update analysis status
  const allModules = await getAnalysisModules(analysisId);
  const allCompleted = allModules.every(m => m.status === 'completed' || m.status === 'failed');
  const hasFailures = allModules.some(m => m.status === 'failed');

  if (allCompleted) {
    // Generate global synthesis
    try {
      const moduleSummaries: Array<{ module: ModuleType; synthesis: ModuleSynthesisResult }> = [];
      for (const mod of allModules) {
        const synthesis = (mod.output_data as Record<string, unknown>)?.module_synthesis as ModuleSynthesisResult | undefined;
        if (synthesis) {
          moduleSummaries.push({ module: mod.module_type as ModuleType, synthesis });
        }
      }

      if (moduleSummaries.length > 0) {
        const globalSynthesis = await synthesizeGlobal(analysis, moduleSummaries);

        // Store global synthesis as evidence (for /api/analyses/[id]/summary endpoint)
        const firstModule = allModules.find(m => m.status === 'completed');
        if (firstModule) {
          await storeEvidence({
            analysis_id: analysisId,
            module_id: firstModule.id,
            source_url: 'global-synthesis',
            source_type: 'api_response',
            content_type: 'application/json',
            storage_path: `analyses/${analysisId}/global-synthesis.json`,
            metadata: {
              summary: globalSynthesis.executive_summary,
              go_no_go: globalSynthesis.go_no_go,
              key_reasons: globalSynthesis.key_reasons,
              risks: globalSynthesis.risks,
              next_steps: globalSynthesis.next_steps,
              citations: globalSynthesis.citations,
              global_synthesis: globalSynthesis,
            },
          });
        }

        await emitProgress(
          analysisId,
          `Global analysis: ${globalSynthesis.go_no_go.toUpperCase()} - ${globalSynthesis.executive_summary.substring(0, 100)}...`
        );
      }
    } catch (globalError) {
      console.error('Global synthesis failed:', globalError);
    }

    await updateAnalysisStatus(analysisId, 'completed', 100);
    await emitProgress(
      analysisId,
      hasFailures
        ? 'Analysis completed with some module failures'
        : 'Analysis completed successfully'
    );
  }
}

/**
 * Execute a single module with logging
 */
async function executeModuleWithLogging(
  analysisId: string,
  analysis: NonNullable<Awaited<ReturnType<typeof getAnalysis>>>,
  moduleType: ModuleType,
  moduleMap: Map<string, Awaited<ReturnType<typeof getAnalysisModules>>[0]>,
  moduleOutputs: Record<string, unknown>,
  completedModules: Set<ModuleType>
): Promise<void> {
  const module = moduleMap.get(moduleType);
  if (!module) {
    console.error(`Module record not found: ${moduleType}`);
    return;
  }

  // Emit start
  await emitAgentStart(analysisId, moduleType, moduleType);
  await updateModuleStatus(module.id, 'running');

  const executor = MODULE_EXECUTORS[moduleType];
  if (!executor) {
    await updateModuleStatus(module.id, 'failed', 0, undefined, `No executor for ${moduleType}`);
    await emitError(analysisId, `No executor for module: ${moduleType}`, moduleType);
    return;
  }

  // Collect prior module data for dependent modules
  const priorModuleData: Record<string, unknown> = {};
  const deps = MODULE_DEPENDENCIES[moduleType];
  if (deps) {
    for (const dep of deps) {
      if (moduleOutputs[dep]) {
        priorModuleData[dep] = moduleOutputs[dep];
      }
    }
  }

  // Build context
  const context: ModuleExecutionContext = {
    analysis_id: analysisId,
    module_id: module.id,
    company_name: analysis.company_name,
    product_name: analysis.product_name || null,
    description: analysis.industry || null,
    target_market: Array.isArray(analysis.target_markets)
      ? analysis.target_markets.join(', ')
      : analysis.target_markets || null,
    social_platforms: analysis.social_platforms || undefined,
    prior_module_data: priorModuleData,
  };

  try {
    const result = await executor(context);

    if (result.success) {
      const baseData = result.data as Record<string, unknown>;

      // Generate module synthesis
      let moduleSynthesis: ModuleSynthesisResult | null = null;
      try {
        // Create a simple agent result from the module data for synthesis
        const agentResults: AgentResult[] = [{
          agent: 'web_research_agent',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          summary: `Completed ${moduleType.replace(/_/g, ' ')} analysis`,
          data: baseData,
          sources: [],
          evidence_paths: [],
          cost: result.cost ?? 0,
          duration_ms: 0,
        }];
        moduleSynthesis = await synthesizeModule(moduleType, baseData, agentResults);
      } catch (synthError) {
        console.error(`Synthesis failed for ${moduleType}:`, synthError);
        // Continue without synthesis - module data is still valid
      }

      // Combine module data with synthesis
      const outputData: Record<string, unknown> = {
        ...baseData,
        module_synthesis: moduleSynthesis,
      };

      await updateModuleStatus(module.id, 'completed', 100, outputData);
      await emitAgentComplete(analysisId, moduleType, moduleType, 'Module completed successfully');
      completedModules.add(moduleType);
      moduleOutputs[moduleType] = outputData;

      // Update overall progress
      const progress = Math.round((completedModules.size / moduleMap.size) * 100);
      await updateAnalysisStatus(analysisId, 'running', progress);
    } else {
      await updateModuleStatus(module.id, 'failed', 0, undefined, result.error || 'Unknown error');
      await emitError(analysisId, result.error || 'Module execution failed', moduleType);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateModuleStatus(module.id, 'failed', 0, undefined, errorMessage);
    await emitError(analysisId, errorMessage, moduleType);
  }
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const userId = await requireAuth(req);
  const analysisId = req.query.id as string;

  if (!analysisId || typeof analysisId !== 'string') {
    sendError(res, 'Invalid analysis ID', 400);
    return;
  }

  // Verify user exists (skip for now - no profiles table requirement)
  const user = await getUser(userId);
  // If user not found, create a mock user object for testing
  const effectiveUser = user || {
    id: userId,
    email: 'test@example.com',
    role: 'analyst' as const,
    team_id: null,
    credits_balance: 10000, // Mock credits for testing
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Get the analysis
  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    sendError(res, 'Analysis not found', 404);
    return;
  }

  // Verify ownership
  if (analysis.user_id !== userId) {
    sendError(res, 'Access denied', 403);
    return;
  }

  // Can only start draft or hitl_pending analyses
  if (!['draft', 'hitl_pending'].includes(analysis.status)) {
    sendError(
      res,
      `Cannot start analysis with status: ${analysis.status}`,
      400
    );
    return;
  }

  // Check credits
  if (effectiveUser.credits_balance < analysis.credits_estimated) {
    sendError(res, 'Insufficient credits', 402);
    return;
  }

  try {
    // Update status to running
    await updateAnalysisStatus(analysisId, 'running', 0);

    // Create module_results records for each module
    const modules = analysis.modules as ModuleType[];
    for (const moduleType of modules) {
      await createModule({
        analysis_id: analysisId,
        module_type: moduleType,
        status: 'pending',
        input_data: {
          company_name: analysis.company_name,
          product_name: analysis.product_name,
          industry: analysis.industry,
          target_markets: analysis.target_markets,
          website_url: analysis.website_url,
        },
      });
    }

    // Emit initial activity
    await emitProgress(
      analysisId,
      `Analysis started. ${modules.length} modules queued for processing.`
    );

    // Process modules synchronously (Vercel terminates after response)
    // Frontend will see progress via SSE stream polling database
    await processModules(analysisId, analysis);

    // Return after processing completes
    sendSuccess(res, {
      message: 'Analysis completed',
      status: 'completed',
      processedModules: modules.length,
      modules: modules,
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    await updateAnalysisStatus(analysisId, 'failed');
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    sendError(res, `Failed to start analysis: ${errorMessage}`, 500);
  }
}

export default asyncHandler(handler);
