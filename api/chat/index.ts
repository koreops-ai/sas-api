/**
 * Chat API
 * POST /api/chat - Multi-model chat with JSON blocks output
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
import { chatRequestSchema } from '../../src/lib/validation.js';
import { runChatCompletion } from '../../src/lib/llm/index.js';

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

  await requireAuth(req);

  const body = await getRequestBody<unknown>(req);
  if (!body) {
    sendError(res, 'Request body is required', 400);
    return;
  }

  const validation = chatRequestSchema.safeParse(body);
  if (!validation.success) {
    sendError(res, `Validation error: ${validation.error.message}`, 400);
    return;
  }

  const { model_provider, model, messages } = validation.data;

  try {
    const data = await runChatCompletion(model_provider, messages, model);
    sendSuccess(res, data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Chat completion failed';
    sendError(res, message, 500);
  }
}

export default asyncHandler(handler);
