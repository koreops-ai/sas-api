import OpenAI from 'openai';
import type { ChatMessage, JsonBlocksResponse } from './types.js';
import { JSON_BLOCKS_SYSTEM_PROMPT, normalizeMessages, parseJsonBlocks } from './utils.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function runOpenAIChat(
  messages: ChatMessage[],
  model = 'gpt-4o-mini'
): Promise<JsonBlocksResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const normalized = normalizeMessages(messages);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: JSON_BLOCKS_SYSTEM_PROMPT },
      ...normalized,
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '';
  return parseJsonBlocks(content);
}
