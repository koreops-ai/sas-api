/**
 * Analysis Summary API
 * GET /api/analyses/[id]/summary - Get global synthesis summary
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
import { getAnalysis, getLatestEvidenceBySource } from '../../../src/lib/supabase.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const userId = await requireAuth(req);
  const analysisId = req.query.id as string;
  if (!analysisId) {
    sendError(res, 'Analysis ID is required', 400);
    return;
  }

  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    sendError(res, 'Analysis not found', 404);
    return;
  }

  if (analysis.user_id !== userId) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  const evidence = await getLatestEvidenceBySource(analysisId, 'global-synthesis');
  const summary = evidence?.metadata?.global_synthesis ?? null;
  sendSuccess(res, { summary });
}

export default asyncHandler(handler);
/**
 * Analysis Summary API
 * GET /api/analyses/[id]/summary - Get global synthesis summary
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
import { getAnalysis, getLatestEvidenceBySource } from '../../../src/lib/supabase.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const userId = await requireAuth(req);
  const analysisId = req.query.id as string;
  if (!analysisId) {
    sendError(res, 'Analysis ID is required', 400);
    return;
  }

  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    sendError(res, 'Analysis not found', 404);
    return;
  }

  if (analysis.user_id !== userId) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  const evidence = await getLatestEvidenceBySource(analysisId, 'global-synthesis');
  if (!evidence) {
    sendSuccess(res, { summary: null });
    return;
  }

  sendSuccess(res, {
    summary: evidence.metadata?.global_synthesis ?? {
      executive_summary: evidence.metadata?.summary ?? null,
      go_no_go: evidence.metadata?.go_no_go ?? null,
      citations: evidence.metadata?.citations ?? [],
    },
    evidence: {
      storage_path: evidence.storage_path,
      created_at: evidence.created_at,
    },
  });
}

export default asyncHandler(handler);
/**
 * Analysis Summary API
 * GET /api/analyses/[id]/summary - Get analysis + modules + global synthesis
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
import { getAnalysis, getAnalysisModules, getLatestEvidenceBySource } from '../../../src/lib/supabase.js';

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

  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    sendError(res, 'Analysis not found', 404);
    return;
  }

  if (analysis.user_id !== userId) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  const modules = await getAnalysisModules(analysisId);
  const globalEvidence = await getLatestEvidenceBySource(analysisId, 'global_synthesis');

  sendSuccess(res, {
    analysis,
    modules,
    global_synthesis: globalEvidence?.metadata ?? null,
  });
}

export default asyncHandler(handler);
