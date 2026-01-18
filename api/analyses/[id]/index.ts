/**
 * Analysis API - Get, Update, Delete
 * GET /api/analyses/[id] - Get analysis details
 * PATCH /api/analyses/[id] - Update analysis (draft only)
 * DELETE /api/analyses/[id] - Delete analysis (draft only)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  getRequestBody,
  setCorsHeaders,
  handleOptions,
} from '../../../src/lib/api.js';
import {
  getAnalysis,
  updateAnalysis,
  getAnalysisModules,
  getUser,
  supabase,
  TABLES,
} from '../../../src/lib/supabase.js';

const UpdateAnalysisSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  company_name: z.string().min(1).max(200).optional(),
  product_name: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  target_market: z.string().max(200).nullable().optional(),
});

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
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
  if (analysis.user_id !== userId) {
    sendError(res, 'Access denied', 403);
    return;
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, analysis);
    case 'PATCH':
      return handleUpdate(req, res, analysis);
    case 'DELETE':
      return handleDelete(req, res, analysis);
    default:
      sendError(res, 'Method not allowed', 405);
  }
}

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  analysis: NonNullable<Awaited<ReturnType<typeof getAnalysis>>>
) {
  // Get modules with their status
  const modules = await getAnalysisModules(analysis.id);

  // Calculate overall progress
  const moduleProgress = modules.map((m) => ({
    id: m.id,
    type: m.module_type,
    status: m.status,
    progress: m.progress,
    started_at: m.started_at,
    completed_at: m.completed_at,
    cost: m.cost,
    has_data: m.data !== null,
    error: m.error,
  }));

  sendSuccess(res, {
    ...analysis,
    modules: moduleProgress,
  });
}

async function handleUpdate(
  req: VercelRequest,
  res: VercelResponse,
  analysis: NonNullable<Awaited<ReturnType<typeof getAnalysis>>>
) {
  // Can only update draft analyses
  if (analysis.status !== 'draft') {
    sendError(res, 'Cannot update analysis that is not in draft status', 400);
    return;
  }

  try {
    const body = await getRequestBody(req);
    if (!body) {
      sendError(res, 'Request body is required', 400);
      return;
    }

    const validated = UpdateAnalysisSchema.parse(body);
    const updated = await updateAnalysis(analysis.id, validated);

    if (!updated) {
      sendError(res, 'Failed to update analysis', 500);
      return;
    }

    sendSuccess(res, updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.message}`, 400);
      return;
    }
    throw error; // Let asyncHandler catch it
  }
}

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  analysis: NonNullable<Awaited<ReturnType<typeof getAnalysis>>>
) {
  // Can only delete draft analyses
  if (analysis.status !== 'draft') {
    sendError(res, 'Cannot delete analysis that is not in draft status', 400);
    return;
  }

  try {
    // Delete modules first (cascade should handle this, but being explicit)
    await supabase
      .from(TABLES.modules)
      .delete()
      .eq('analysis_id', analysis.id);

    // Delete the analysis
    const { error } = await supabase
      .from(TABLES.analyses)
      .delete()
      .eq('id', analysis.id);

    if (error) {
      console.error('Error deleting analysis:', error);
      sendError(res, 'Failed to delete analysis', 500);
      return;
    }

    res.status(204).end();
  } catch (error) {
    throw error; // Let asyncHandler catch it
  }
}

export default asyncHandler(handler);
