/**
 * API: /api/worker/process
 * POST/GET - Process queued modules
 *
 * Called by Vercel Cron every minute to process queued modules.
 * Can also be called manually for testing.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  setCorsHeaders,
  handleOptions,
} from '../../src/lib/api.js';
import {
  getAnalysis,
  updateAnalysisStatus,
  getAnalysisModules,
  updateModuleStatus,
} from '../../src/lib/supabase.js';
import {
  claimNextJob,
  completeJob,
  failJob,
  isAnalysisComplete,
  type QueuedJob,
} from '../../src/lib/queue.js';
import {
  emitProgress,
  emitAgentStart,
  emitAgentComplete,
  emitError,
  emitHITLPending,
} from '../../src/lib/activity-emitter.js';
import type { ModuleType } from '../../src/types/database.js';
import type { ModuleExecutionContext, ModuleResult } from '../../src/types/modules.js';

// Import module executors
import { executeMarketDemand } from '../../src/modules/market-demand.js';
import { executeRevenueIntelligence } from '../../src/modules/revenue-intelligence.js';
import { executeCompetitiveIntelligence } from '../../src/modules/competitive-intelligence.js';
import { executeSocialSentiment } from '../../src/modules/social-sentiment.js';
import { executeLinkedInContacts } from '../../src/modules/linkedin-contacts.js';
import { executeGoogleMaps } from '../../src/modules/google-maps.js';
import { executeFinancialModeling } from '../../src/modules/financial-modeling.js';
import { executeRiskAssessment } from '../../src/modules/risk-assessment.js';
import { executeOperationalFeasibility } from '../../src/modules/operational-feasibility.js';

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

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  // Allow both GET (for cron) and POST (for manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  try {
    // Claim next job from queue
    const job = await claimNextJob();

    if (!job) {
      sendSuccess(res, { message: 'No jobs in queue', processed: false });
      return;
    }

    console.log(`Processing job: ${job.id} (${job.module_type})`);

    // Check if dependencies are met
    const dependenciesMet = await checkDependencies(job);
    if (!dependenciesMet) {
      // Re-queue with lower priority - dependencies not ready
      await failJob(job.id, 'Dependencies not yet completed');
      sendSuccess(res, {
        message: 'Dependencies not met, job re-queued',
        moduleType: job.module_type,
        processed: false,
      });
      return;
    }

    // Get analysis for context
    const analysis = await getAnalysis(job.analysis_id);
    if (!analysis) {
      await failJob(job.id, 'Analysis not found');
      sendError(res, 'Analysis not found', 404);
      return;
    }

    // Get module record
    const modules = await getAnalysisModules(job.analysis_id);
    const module = modules.find(m => m.module_type === job.module_type);

    if (!module) {
      await failJob(job.id, 'Module record not found');
      sendError(res, 'Module record not found', 404);
      return;
    }

    // Emit start activity
    await emitAgentStart(job.analysis_id, job.module_type as ModuleType, job.module_type);

    // Update module status to running
    await updateModuleStatus(module.id, 'running');

    // Get executor
    const executor = MODULE_EXECUTORS[job.module_type as ModuleType];
    if (!executor) {
      await failJob(job.id, `No executor for module: ${job.module_type}`);
      await emitError(job.analysis_id, `No executor for module: ${job.module_type}`, job.module_type as ModuleType);
      sendError(res, `No executor for module: ${job.module_type}`, 500);
      return;
    }

    // Collect prior module data for dependent modules
    const priorModuleData = await collectPriorModuleData(job.analysis_id, job.module_type as ModuleType, modules);

    // Build execution context
    const context: ModuleExecutionContext = {
      analysis_id: job.analysis_id,
      module_id: module.id,
      company_name: analysis.company_name,
      product_name: analysis.product_name || null,
      description: analysis.industry || null, // Using industry as description for now
      target_market: Array.isArray(analysis.target_markets)
        ? analysis.target_markets.join(', ')
        : analysis.target_markets || null,
      social_platforms: analysis.social_platforms || undefined,
      prior_module_data: priorModuleData,
    };

    // Execute module
    const result = await executor(context);

    if (result.success) {
      // Update module as completed
      await updateModuleStatus(module.id, 'completed', 100, result.data as Record<string, unknown>);
      await completeJob(job.id);
      await emitAgentComplete(job.analysis_id, job.module_type as ModuleType, job.module_type, 'Module completed successfully');

      // Check if analysis is complete
      const { complete, hasFailures } = await isAnalysisComplete(job.analysis_id);

      if (complete) {
        const finalStatus = hasFailures ? 'completed' : 'completed';
        await updateAnalysisStatus(job.analysis_id, finalStatus, 100);
        await emitProgress(job.analysis_id, `Analysis ${hasFailures ? 'completed with some failures' : 'completed successfully'}`);
      } else {
        // Update progress
        const progress = await calculateProgress(job.analysis_id);
        await updateAnalysisStatus(job.analysis_id, 'running', progress);
      }

      sendSuccess(res, {
        message: 'Module processed successfully',
        moduleType: job.module_type,
        processed: true,
      });
    } else {
      // Module failed
      await updateModuleStatus(module.id, 'failed', 0, undefined, result.error || 'Unknown error');
      await failJob(job.id, result.error || 'Unknown error');
      await emitError(job.analysis_id, result.error || 'Module execution failed', job.module_type as ModuleType);

      sendSuccess(res, {
        message: 'Module failed',
        moduleType: job.module_type,
        error: result.error,
        processed: true,
      });
    }
  } catch (error) {
    console.error('Worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendError(res, `Worker error: ${errorMessage}`, 500);
  }
}

/**
 * Check if all dependencies for a module are completed
 */
async function checkDependencies(job: QueuedJob): Promise<boolean> {
  const deps = MODULE_DEPENDENCIES[job.module_type as ModuleType];
  if (!deps || deps.length === 0) {
    return true; // No dependencies
  }

  const modules = await getAnalysisModules(job.analysis_id);

  for (const depType of deps) {
    const depModule = modules.find(m => m.module_type === depType);
    if (!depModule || depModule.status !== 'completed') {
      return false;
    }
  }

  return true;
}

/**
 * Collect data from prior modules for dependent modules
 */
async function collectPriorModuleData(
  analysisId: string,
  moduleType: ModuleType,
  modules: Awaited<ReturnType<typeof getAnalysisModules>>
): Promise<Record<string, unknown>> {
  const deps = MODULE_DEPENDENCIES[moduleType];
  if (!deps || deps.length === 0) {
    return {};
  }

  const priorData: Record<string, unknown> = {};

  for (const depType of deps) {
    const depModule = modules.find(m => m.module_type === depType);
    if (depModule?.output_data) {
      priorData[depType] = depModule.output_data;
    }
  }

  return priorData;
}

/**
 * Calculate overall analysis progress
 */
async function calculateProgress(analysisId: string): Promise<number> {
  const modules = await getAnalysisModules(analysisId);
  if (modules.length === 0) return 0;

  const completed = modules.filter(m => m.status === 'completed' || m.status === 'failed').length;
  return Math.round((completed / modules.length) * 100);
}

export default asyncHandler(handler);
