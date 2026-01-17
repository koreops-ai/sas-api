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
