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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatOpenAI(
  messages: ChatMessage[],
  model = 'gpt-4o-mini',
  temperature = 0.3,
  maxTokens = 2048
): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  return {
    content,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}
