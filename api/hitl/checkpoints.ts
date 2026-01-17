/**
 * HITL Checkpoints API
 * GET /api/hitl/checkpoints - Get pending checkpoints for user
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  setCorsHeaders,
  handleOptions,
} from '@/lib/api.js';
import { getPendingHITLCheckpoints } from '@/lib/supabase.js';

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

  const checkpoints = await getPendingHITLCheckpoints(userId);

  sendSuccess(res, { checkpoints });
}

export default asyncHandler(handler);
