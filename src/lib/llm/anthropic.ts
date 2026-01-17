import type { ChatMessage, JsonBlocksResponse } from './types.js';
import { sendMessageForJSON } from '../anthropic.js';
import { JSON_BLOCKS_SYSTEM_PROMPT, normalizeMessages } from './utils.js';

function buildAnthropicPrompt(messages: ChatMessage[]): string {
  const normalized = normalizeMessages(messages);
  return normalized
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');
}

export async function runAnthropicChat(
  messages: ChatMessage[],
  model = 'claude-sonnet-4-20250514'
): Promise<JsonBlocksResponse> {
  const prompt = `${JSON_BLOCKS_SYSTEM_PROMPT}\n\n${buildAnthropicPrompt(messages)}`;
  const result = await sendMessageForJSON<JsonBlocksResponse>(prompt, {
    model: model as any,
    maxTokens: 4096,
  });
  return result.data;
}
