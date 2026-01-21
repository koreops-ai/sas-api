/**
 * Analysis Activities API
 * GET /api/analyses/[id]/activities - Get activity logs for an analysis
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
import { getAnalysis, getActivityLogs } from '../../../src/lib/supabase.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const userId = await requireAuth(req);

  if (req.method !== 'GET') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const analysisId = req.query.id as string;
  if (!analysisId) {
    sendError(res, 'Analysis ID is required', 400);
    return;
  }

  // Verify analysis exists and user has access
  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    sendError(res, 'Analysis not found', 404);
    return;
  }

  if (analysis.user_id !== userId) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  const activities = await getActivityLogs(analysisId);

  sendSuccess(res, activities);
}

export default asyncHandler(handler);
