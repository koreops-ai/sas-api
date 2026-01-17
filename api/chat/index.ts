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
/**
 * Chat API - Multi-model chat with JSON blocks output
 * POST /api/chat
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
import { runChat, type Provider, type ChatMessage } from '../../src/lib/llm/index.js';
import { safeParseJsonBlocks } from '../../src/lib/llm/json-blocks.js';

interface ChatRequestBody {
  provider: Provider;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
};

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

  const body = await getRequestBody<ChatRequestBody>(req);
  if (!body) {
    sendError(res, 'Request body is required', 400);
    return;
  }

  if (!body.provider || !['anthropic', 'openai', 'gemini'].includes(body.provider)) {
    sendError(res, 'Invalid provider', 400);
    return;
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    sendError(res, 'messages must be a non-empty array', 400);
    return;
  }

  const model = body.model ?? DEFAULT_MODELS[body.provider];

  try {
    const result = await runChat({
      provider: body.provider,
      model,
      messages: body.messages,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });

    const parsed = safeParseJsonBlocks(result.content);

    sendSuccess(res, {
      provider: body.provider,
      model,
      output_format: 'json_blocks',
      blocks: parsed.blocks,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown chat error';
    sendError(res, message, 500);
  }
}

export default asyncHandler(handler);
