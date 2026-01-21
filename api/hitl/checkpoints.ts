/**
 * HITL Checkpoints API
 * GET /api/hitl/checkpoints - Get pending checkpoints for user
 * POST /api/hitl/checkpoints - Resolve a HITL checkpoint (pass checkpoint_id in body)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  getRequestBody,
  setCorsHeaders,
  handleOptions,
} from '../../src/lib/api.js';
import {
  getPendingHITLCheckpoints,
  getHITLCheckpoint,
  resolveHITLCheckpoint,
  getAnalysis,
  updateModuleStatus,
} from '../../src/lib/supabase.js';
import { hitlApprovalSchema } from '../../src/lib/validation.js';
import { continueAfterHITL } from '../../src/lib/module-runner.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const userId = await requireAuth(req);

  // GET - List pending checkpoints
  if (req.method === 'GET') {
    const checkpoints = await getPendingHITLCheckpoints(userId);
    sendSuccess(res, { checkpoints });
    return;
  }

  // POST - Resolve a checkpoint
  if (req.method === 'POST') {
    // Get request body
    const body = await getRequestBody(req);
    if (!body) {
      sendError(res, 'Request body is required', 400);
      return;
    }

    // Validate request body
    const validation = hitlApprovalSchema.safeParse(body);
    if (!validation.success) {
      sendError(res, `Validation error: ${validation.error.message}`, 400);
      return;
    }

    const input = validation.data;
    const checkpointId = input.checkpoint_id;

    // Get checkpoint
    const checkpoint = await getHITLCheckpoint(checkpointId);
    if (!checkpoint) {
      sendError(res, 'Checkpoint not found', 404);
      return;
    }

    // Verify user has access to this checkpoint's analysis
    const analysis = await getAnalysis(checkpoint.analysis_id);
    if (!analysis || analysis.user_id !== userId) {
      sendError(res, 'Forbidden', 403);
      return;
    }

    // Check if checkpoint is already resolved
    if (checkpoint.status !== 'pending') {
      sendError(res, 'Checkpoint is already resolved', 400);
      return;
    }

    // Resolve checkpoint
    const resolved = await resolveHITLCheckpoint(
      checkpointId,
      userId,
      input.action,
      input.comment,
      input.adjustments
    );

    if (!resolved) {
      sendError(res, 'Failed to resolve checkpoint', 500);
      return;
    }

    // Handle post-resolution actions based on action type
    let continuationResult = null;

    if (input.action === 'approve_all' || input.action === 'approve_selected') {
      // Mark module as completed
      await updateModuleStatus(checkpoint.module_id, 'completed', 100);

      // Continue execution with any dependent modules
      continuationResult = await continueAfterHITL(checkpoint.analysis_id);
    } else if (input.action === 'request_revision') {
      // Mark module as needing revision
      await updateModuleStatus(checkpoint.module_id, 'revision_requested', 50);
    } else if (input.action === 'reject') {
      // Mark module as failed/skipped
      await updateModuleStatus(checkpoint.module_id, 'skipped', 100);

      // Continue execution with remaining modules
      continuationResult = await continueAfterHITL(checkpoint.analysis_id);
    }

    sendSuccess(res, {
      checkpoint: resolved,
      continuation: continuationResult ? {
        modules_executed: continuationResult.modulesExecuted,
        is_complete: continuationResult.isComplete,
        is_awaiting_hitl: continuationResult.isAwaitingHITL,
        progress: continuationResult.progress,
      } : null,
    }, 'Checkpoint resolved successfully');
    return;
  }

  sendError(res, 'Method not allowed', 405);
}

export default asyncHandler(handler);
