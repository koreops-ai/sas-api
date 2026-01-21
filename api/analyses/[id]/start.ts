/**
 * API: /api/analyses/[id]/start
 * POST - Start analysis execution
 *
 * This endpoint queues modules for async processing.
 * Returns immediately - frontend subscribes to activity_logs for live updates.
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
} from '../../../src/lib/supabase.js';
import { queueModulesForAnalysis } from '../../../src/lib/queue.js';
import { emitProgress } from '../../../src/lib/activity-emitter.js';
import type { ModuleType } from '../../../src/types/database.js';

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

    // Queue all modules for async processing
    const queuedJobs = await queueModulesForAnalysis(analysisId, modules);

    // Emit initial activity
    await emitProgress(
      analysisId,
      `Analysis started. ${queuedJobs.length} modules queued for processing.`
    );

    // Return immediately - worker will process modules
    sendSuccess(res, {
      message: 'Analysis started',
      status: 'running',
      queuedModules: queuedJobs.length,
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
