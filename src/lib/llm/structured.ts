import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LlmProvider } from './types.js';
import { sendMessageForJSON } from '../anthropic.js';

interface JsonCompletionResult<T> {
  data: T;
  raw: string;
  cost: number;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

export async function runJsonCompletion<T>(
  provider: LlmProvider,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<JsonCompletionResult<T>> {
  if (provider === 'anthropic') {
    const result = await sendMessageForJSON<T>(userPrompt, {
      model: model as any,
      system: systemPrompt,
      maxTokens: 4096,
    });
    return { data: result.data, raw: JSON.stringify(result.data), cost: result.cost };
  }

  if (provider === 'openai') {
    if (!OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content || '{}';
    const jsonText = extractJson(content);
    return { data: JSON.parse(jsonText) as T, raw: content, cost: 0 };
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ model });
  const prompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn ONLY valid JSON.`;
  const result = await geminiModel.generateContent(prompt);
  const content = result.response.text();
  const jsonText = extractJson(content);
  return { data: JSON.parse(jsonText) as T, raw: content, cost: 0 };
}
