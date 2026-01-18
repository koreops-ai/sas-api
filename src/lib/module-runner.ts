/**
 * Module Runner
 * Executes analysis modules based on the orchestrator's ready queue
 */

import type { ModuleType } from '../types/database.js';
import type { ModuleExecutionContext, ModuleResult } from '../types/modules.js';
import { AnalysisOrchestrator, createOrchestrator } from './orchestrator.js';

// Dynamic imports for modules to avoid loading all at once
const MODULE_EXECUTORS: Record<
  ModuleType,
  () => Promise<(context: ModuleExecutionContext) => Promise<ModuleResult<unknown>>>
> = {
  market_demand: async () => {
    const { executeMarketDemand } = await import('../modules/market-demand.js');
    return executeMarketDemand;
  },
  revenue_intelligence: async () => {
    const { executeRevenueIntelligence } = await import('../modules/revenue-intelligence.js');
    return executeRevenueIntelligence;
  },
  competitive_intelligence: async () => {
    const { executeCompetitiveIntelligence } = await import('../modules/competitive-intelligence.js');
    return executeCompetitiveIntelligence;
  },
  social_sentiment: async () => {
    const { executeSocialSentiment } = await import('../modules/social-sentiment.js');
    return executeSocialSentiment;
  },
  linkedin_contacts: async () => {
    const { executeLinkedInContacts } = await import('../modules/linkedin-contacts.js');
    return executeLinkedInContacts;
  },
  google_maps: async () => {
    const { executeGoogleMaps } = await import('../modules/google-maps.js');
    return executeGoogleMaps;
  },
  financial_modeling: async () => {
    const { executeFinancialModeling } = await import('../modules/financial-modeling.js');
    return executeFinancialModeling;
  },
  risk_assessment: async () => {
    const { executeRiskAssessment } = await import('../modules/risk-assessment.js');
    return executeRiskAssessment;
  },
  operational_feasibility: async () => {
    const { executeOperationalFeasibility } = await import('../modules/operational-feasibility.js');
    return executeOperationalFeasibility;
  },
};

export interface RunnerResult {
  success: boolean;
  modulesExecuted: ModuleType[];
  modulesFailed: ModuleType[];
  isComplete: boolean;
  isAwaitingHITL: boolean;
  progress: number;
  error?: string;
}

/**
 * Run all ready modules for an analysis
 */
export async function runAnalysisModules(
  analysisId: string,
  options: {
    maxModules?: number;
    parallelExecution?: boolean;
  } = {}
): Promise<RunnerResult> {
  const orchestrator = await createOrchestrator(analysisId, {
    enableHITL: true,
    parallelExecution: options.parallelExecution ?? true,
    maxConcurrentModules: options.maxModules ?? 4,
  });

  if (!orchestrator) {
    return {
      success: false,
      modulesExecuted: [],
      modulesFailed: [],
      isComplete: false,
      isAwaitingHITL: false,
      progress: 0,
      error: 'Failed to initialize orchestrator',
    };
  }

  const modulesExecuted: ModuleType[] = [];
  const modulesFailed: ModuleType[] = [];

  // Get modules ready to execute
  const readyModules = orchestrator.getReadyModules();

  if (readyModules.length === 0) {
    // Check if we're waiting for HITL or complete
    const progress = await orchestrator.updateProgress();
    return {
      success: true,
      modulesExecuted: [],
      modulesFailed: [],
      isComplete: orchestrator.isComplete(),
      isAwaitingHITL: orchestrator.isAwaitingHITL(),
      progress,
    };
  }

  // Execute modules (parallel or sequential)
  if (options.parallelExecution ?? true) {
    // Execute in parallel
    const results = await Promise.allSettled(
      readyModules.map(async (moduleType) => {
        const executor = await MODULE_EXECUTORS[moduleType]();
        const success = await orchestrator.executeModule(moduleType, executor);
        return { moduleType, success };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          modulesExecuted.push(result.value.moduleType);
        } else {
          modulesFailed.push(result.value.moduleType);
        }
      } else {
        // Promise rejected - find which module failed
        console.error('Module execution failed:', result.reason);
      }
    }
  } else {
    // Execute sequentially
    for (const moduleType of readyModules) {
      try {
        const executor = await MODULE_EXECUTORS[moduleType]();
        const success = await orchestrator.executeModule(moduleType, executor);
        if (success) {
          modulesExecuted.push(moduleType);
        } else {
          modulesFailed.push(moduleType);
        }
      } catch (error) {
        console.error(`Error executing ${moduleType}:`, error);
        modulesFailed.push(moduleType);
      }
    }
  }

  // Update progress
  const progress = await orchestrator.updateProgress();

  // Check if complete
  const isComplete = orchestrator.isComplete();
  const isAwaitingHITL = orchestrator.isAwaitingHITL();

  // Finalize if complete
  if (isComplete) {
    await orchestrator.finalize();
  }

  return {
    success: modulesFailed.length === 0,
    modulesExecuted,
    modulesFailed,
    isComplete,
    isAwaitingHITL,
    progress,
  };
}

/**
 * Run a specific module for an analysis
 */
export async function runSingleModule(
  analysisId: string,
  moduleType: ModuleType
): Promise<{ success: boolean; error?: string }> {
  const orchestrator = await createOrchestrator(analysisId, {
    enableHITL: true,
    parallelExecution: false,
  });

  if (!orchestrator) {
    return { success: false, error: 'Failed to initialize orchestrator' };
  }

  try {
    const executor = await MODULE_EXECUTORS[moduleType]();
    const success = await orchestrator.executeModule(moduleType, executor);
    await orchestrator.updateProgress();
    return { success };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Continue execution after HITL approval
 * Runs any newly ready modules (dependent modules)
 */
export async function continueAfterHITL(analysisId: string): Promise<RunnerResult> {
  return runAnalysisModules(analysisId);
}
