/**
 * API: /api/analyses/[id]/start
 * POST - Start analysis execution
 *
 * This endpoint initiates the analysis workflow.
 * It runs modules in parallel where possible and creates HITL checkpoints.
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
} from '../../../src/lib/supabase.js';
import { createOrchestrator } from '../../../src/lib/orchestrator.js';

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
import type { ModuleType } from '../../../src/types/database.js';
import type { ModuleExecutionContext, ModuleResult } from '../../../src/types/modules.js';

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

  // Verify user exists
  const user = await getUser(userId);
  if (!user) {
    sendError(res, 'User not found', 401);
    return;
  }

  // Get the analysis
  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    sendError(res, 'Analysis not found', 404);
    return;
  }

  // Verify ownership
  if (analysis.user_id !== userId && analysis.team_id !== user.team_id) {
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
  if (user.credits_balance < analysis.estimated_cost) {
    sendError(res, 'Insufficient credits', 402);
    return;
  }

  try {
    // Initialize orchestrator
    const orchestrator = await createOrchestrator(analysisId, {
      enableHITL: true,
      parallelExecution: true,
      maxConcurrentModules: 4,
    });

    if (!orchestrator) {
      sendError(res, 'Failed to initialize orchestrator', 500);
      return;
    }

    // Update status to running
    await updateAnalysisStatus(analysisId, 'running', 0);

    // Get modules ready to execute
    const readyModules = orchestrator.getReadyModules();

    if (readyModules.length === 0) {
      // Check if we're waiting for HITL
      if (orchestrator.isAwaitingHITL()) {
        sendSuccess(res, {
          message: 'Analysis is awaiting HITL approval',
          status: 'hitl_pending',
          summary: orchestrator.getSummary(),
        });
        return;
      }

      // Check if already complete
      if (orchestrator.isComplete()) {
        await orchestrator.finalize();
        sendSuccess(res, {
          message: 'Analysis is already complete',
          status: 'completed',
          summary: orchestrator.getSummary(),
        });
        return;
      }

      sendSuccess(res, {
        message: 'No modules ready to execute',
        summary: orchestrator.getSummary(),
      });
      return;
    }

    // Execute modules in parallel (where possible)
    const executionPromises = readyModules.map(async (moduleType) => {
      const executor = MODULE_EXECUTORS[moduleType];
      if (!executor) {
        console.warn(`No executor for module: ${moduleType}`);
        return { moduleType, success: false, error: 'No executor found' };
      }

      const success = await orchestrator.executeModule(moduleType, executor);
      return { moduleType, success };
    });

    // Wait for parallel modules to complete
    const results = await Promise.all(executionPromises);

    // Update progress
    await orchestrator.updateProgress();

    // Check if more modules can run (dependent modules)
    const nextReadyModules = orchestrator.getReadyModules();

    // Execute dependent modules if ready
    if (nextReadyModules.length > 0) {
      const dependentPromises = nextReadyModules.map(async (moduleType) => {
        const executor = MODULE_EXECUTORS[moduleType];
        if (!executor) {
          return { moduleType, success: false, error: 'No executor found' };
        }

        const success = await orchestrator.executeModule(moduleType, executor);
        return { moduleType, success };
      });

      const dependentResults = await Promise.all(dependentPromises);
      results.push(...dependentResults);
    }

    // Final progress update
    await orchestrator.updateProgress();

    // Check final state
    const summary = orchestrator.getSummary();

    if (orchestrator.isComplete()) {
      await orchestrator.finalize();
      sendSuccess(res, {
        message: 'Analysis completed',
        status: 'completed',
        results,
        summary,
      });
      return;
    }

    if (orchestrator.isAwaitingHITL()) {
      sendSuccess(res, {
        message: 'Analysis paused for HITL review',
        status: 'hitl_pending',
        results,
        summary,
      });
      return;
    }

    sendSuccess(res, {
      message: 'Analysis in progress',
      status: 'running',
      results,
      summary,
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    await updateAnalysisStatus(analysisId, 'failed');
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    sendError(res, `Analysis execution failed: ${errorMessage}`, 500);
  }
}

export default asyncHandler(handler);
