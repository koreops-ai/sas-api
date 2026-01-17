import type { ChatMessage, JsonBlocksResponse, LlmProvider } from './types.js';
import { runAnthropicChat } from './anthropic.js';
import { runOpenAIChat } from './openai.js';
import { runGeminiChat } from './gemini.js';

export async function runChatCompletion(
  provider: LlmProvider,
  messages: ChatMessage[],
  model?: string
): Promise<JsonBlocksResponse> {
  switch (provider) {
    case 'anthropic':
      return runAnthropicChat(messages, model);
    case 'openai':
      return runOpenAIChat(messages, model);
    case 'gemini':
      return runGeminiChat(messages, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

import { chatAnthropic } from './anthropic.js';
import { chatOpenAI } from './openai.js';
import { chatGemini } from './gemini.js';
import { buildJsonBlocksSystemPrompt } from './json-blocks.js';

export type Provider = 'anthropic' | 'openai' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  provider: Provider;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export async function runChat(request: ChatRequest): Promise<{ content: string }> {
  const systemPrompt = buildJsonBlocksSystemPrompt();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...request.messages,
  ];

  const temperature = request.temperature ?? 0.3;
  const maxTokens = request.maxTokens ?? 4096;

  if (request.provider === 'anthropic') {
    return chatAnthropic(messages, request.model, temperature, maxTokens);
  }
  if (request.provider === 'openai') {
    return chatOpenAI(messages, request.model, temperature, maxTokens);
  }
  if (request.provider === 'gemini') {
    return chatGemini(messages, request.model, temperature, maxTokens);
  }

  throw new Error(`Unsupported provider: ${request.provider}`);
}
