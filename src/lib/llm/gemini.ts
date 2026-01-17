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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
}

export async function chatGemini(
  messages: ChatMessage[],
  model = 'gemini-1.5-flash',
  temperature = 0.3,
  maxTokens = 2048
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages.filter((m) => m.role !== 'system');

  const contents = userMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { role: 'system', parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return { content };
}
