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

import { anthropic, MODELS } from '../anthropic.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatAnthropic(
  messages: ChatMessage[],
  model = MODELS.analysis,
  temperature = 0.3,
  maxTokens = 4096
): Promise<ChatResponse> {
  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages.filter((m) => m.role !== 'system');

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: userMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  });

  const content = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
