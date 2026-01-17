/**
 * Preset Detail API
 * GET /api/presets/[id] - Get a specific preset
 * PATCH /api/presets/[id] - Update a preset
 * DELETE /api/presets/[id] - Delete a preset
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
} from '../../../src/lib/api.js';
import {
  getPreset,
  updatePreset,
  deletePreset,
  getUser,
} from '../../../src/lib/supabase.js';
import { updatePresetSchema } from '../../../src/lib/validation.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  const userId = await requireAuth(req);
  const presetId = req.query.id as string;

  if (!presetId || typeof presetId !== 'string') {
    sendError(res, 'Invalid preset ID', 400);
    return;
  }

  // GET - Get preset
  if (req.method === 'GET') {
    const preset = await getPreset(presetId);
    if (!preset) {
      sendError(res, 'Preset not found', 404);
      return;
    }

    // Check access (system, user-owned, or team preset)
    const user = await getUser(userId);
    const hasAccess =
      preset.is_system ||
      preset.user_id === userId ||
      (preset.team_id && preset.team_id === user?.team_id);

    if (!hasAccess) {
      sendError(res, 'Access denied', 403);
      return;
    }

    sendSuccess(res, { preset });
    return;
  }

  // PATCH - Update preset
  if (req.method === 'PATCH') {
    const preset = await getPreset(presetId);
    if (!preset) {
      sendError(res, 'Preset not found', 404);
      return;
    }

    // Can't update system presets
    if (preset.is_system) {
      sendError(res, 'Cannot update system preset', 403);
      return;
    }

    // Verify ownership
    if (preset.user_id !== userId) {
      sendError(res, 'Access denied', 403);
      return;
    }

    const body = await getRequestBody<unknown>(req);
    if (!body) {
      sendError(res, 'Request body is required', 400);
      return;
    }

    const validationResult = updatePresetSchema.safeParse(body);
    if (!validationResult.success) {
      sendError(res, `Validation error: ${validationResult.error.message}`, 400);
      return;
    }

    const updatedPreset = await updatePreset(presetId, {
      name: validationResult.data.name,
      description: validationResult.data.description,
      modules: validationResult.data.modules,
      social_platforms: validationResult.data.social_platforms,
    });

    if (!updatedPreset) {
      sendError(res, 'Failed to update preset', 500);
      return;
    }

    sendSuccess(res, { preset: updatedPreset }, 'Preset updated successfully');
    return;
  }

  // DELETE - Delete preset
  if (req.method === 'DELETE') {
    const preset = await getPreset(presetId);
    if (!preset) {
      sendError(res, 'Preset not found', 404);
      return;
    }

    const success = await deletePreset(presetId, userId);
    if (!success) {
      sendError(res, 'Failed to delete preset or access denied', 403);
      return;
    }

    sendSuccess(res, { id: presetId }, 'Preset deleted successfully');
    return;
  }

  // Method not allowed
  sendError(res, 'Method not allowed', 405);
}

export default asyncHandler(handler);
