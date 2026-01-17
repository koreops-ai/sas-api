/**
 * Presets API
 * GET /api/presets - List available presets
 * POST /api/presets - Create a new preset
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  setCorsHeaders,
  handleOptions,
  getRequestBody,
} from '../../src/lib/api.js';
import {
  getPresets,
  getPreset,
  createPreset,
  updatePreset,
  deletePreset,
  getUser,
} from '../../src/lib/supabase.js';
import { createPresetSchema, updatePresetSchema } from '../../src/lib/validation.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const userId = await requireAuth(req);

  // GET - List presets
  if (req.method === 'GET') {
    const user = await getUser(userId);
    const teamId = user?.team_id || undefined;
    const presets = await getPresets(userId, teamId);
    sendSuccess(res, { presets });
    return;
  }

  // POST - Create preset
  if (req.method === 'POST') {
    const body = await getRequestBody<unknown>(req);
    if (!body) {
      sendError(res, 'Request body is required', 400);
      return;
    }

    const validationResult = createPresetSchema.safeParse(body);
    if (!validationResult.success) {
      sendError(res, `Validation error: ${validationResult.error.message}`, 400);
      return;
    }

    const user = await getUser(userId);
    const preset = await createPreset({
      name: validationResult.data.name,
      description: validationResult.data.description || null,
      user_id: userId,
      team_id: validationResult.data.team_id || user?.team_id || null,
      is_system: false,
      modules: validationResult.data.modules,
      social_platforms: validationResult.data.social_platforms || null,
    });

    if (!preset) {
      sendError(res, 'Failed to create preset', 500);
      return;
    }

    sendSuccess(res, { preset }, 'Preset created successfully');
    return;
  }

  // Method not allowed
  sendError(res, 'Method not allowed', 405);
}

export default asyncHandler(handler);
