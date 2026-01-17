import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage, JsonBlocksResponse } from './types.js';
import { JSON_BLOCKS_SYSTEM_PROMPT, normalizeMessages, parseJsonBlocks } from './utils.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function buildGeminiPrompt(messages: ChatMessage[]): string {
  const normalized = normalizeMessages(messages);
  const conversation = normalized
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');
  return `${JSON_BLOCKS_SYSTEM_PROMPT}\n\n${conversation}`;
}

export async function runGeminiChat(
  messages: ChatMessage[],
  model = 'gemini-1.5-pro'
): Promise<JsonBlocksResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ model });
  const prompt = buildGeminiPrompt(messages);

  const result = await geminiModel.generateContent(prompt);
  const content = result.response.text();
  return parseJsonBlocks(content);
}
