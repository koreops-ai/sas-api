/**
 * Analyses API - List and Create
 * GET /api/analyses - List analyses
 * POST /api/analyses - Create new analysis
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  getRequestBody,
  getQueryParamAsNumber,
  setCorsHeaders,
  handleOptions,
} from '../../src/lib/api.js';
import { createAnalysisSchema } from '../../src/lib/validation.js';
import {
  listAnalyses,
  createAnalysis,
  getPreset,
} from '../../src/lib/supabase.js';
import type { AnalysisStatus } from '../../src/types/database.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const userId = await requireAuth(req);

  // GET /api/analyses - List analyses
  if (req.method === 'GET') {
    const limit = getQueryParamAsNumber(req, 'limit', 10);
    const offset = getQueryParamAsNumber(req, 'offset', 0);
    const statusParam = req.query.status as AnalysisStatus | undefined;

    const result = await listAnalyses(userId, limit, offset, statusParam);

    sendSuccess(res, {
      data: result.data,
      total: result.total,
      limit,
      offset,
    });
    return;
  }

  // POST /api/analyses - Create analysis
  if (req.method === 'POST') {
    const body = await getRequestBody(req);
    if (!body) {
      sendError(res, 'Request body is required', 400);
      return;
    }

    // Validate request body
    const validation = createAnalysisSchema.safeParse(body);
    if (!validation.success) {
      sendError(res, `Validation error: ${validation.error.message}`, 400);
      return;
    }

    const input = validation.data;

    // Load preset if provided
    let selectedModules = input.selected_modules;
    let socialPlatforms = input.social_platforms;

    if (input.preset_id) {
      const preset = await getPreset(input.preset_id);
      if (!preset) {
        sendError(res, 'Preset not found', 404);
        return;
      }
      selectedModules = preset.modules;
      socialPlatforms = preset.social_platforms ?? undefined;
    }

    // Create analysis
    const analysis = await createAnalysis({
      user_id: userId,
      name: input.name,
      company_name: input.company_name,
      product_name: input.product_name ?? null,
      description: input.description ?? null,
      target_market: input.target_market ?? null,
      status: 'draft',
      progress: 0,
      selected_modules: selectedModules,
      social_platforms: socialPlatforms ?? null,
      estimated_cost: 0, // TODO: Calculate based on modules
      actual_cost: 0,
    });

    if (!analysis) {
      sendError(res, 'Failed to create analysis', 500);
      return;
    }

    sendSuccess(res, analysis, 'Analysis created successfully', 201);
    return;
  }

  sendError(res, 'Method not allowed', 405);
}

export default asyncHandler(handler);
