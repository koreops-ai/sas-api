/**
 * Resolve HITL Checkpoint API
 * POST /api/hitl/checkpoints/[id]/resolve - Resolve a HITL checkpoint
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
} from '../../../../src/lib/api.js';
import {
  getHITLCheckpoint,
  resolveHITLCheckpoint,
  getAnalysis,
  updateModuleStatus,
} from '../../../../src/lib/supabase.js';
import { hitlApprovalSchema } from '../../../../src/lib/validation.js';
import { continueAfterHITL } from '../../../../src/lib/module-runner.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const userId = await requireAuth(req);

  if (req.method !== 'POST') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const checkpointId = req.query.id as string;
  if (!checkpointId) {
    sendError(res, 'Checkpoint ID is required', 400);
    return;
  }

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

  // Verify checkpoint ID matches
  if (input.checkpoint_id !== checkpointId) {
    sendError(res, 'Checkpoint ID mismatch', 400);
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
}

export default asyncHandler(handler);
