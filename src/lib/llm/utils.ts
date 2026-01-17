import type { ChatMessage, JsonBlocksResponse } from './types.js';

export const JSON_BLOCKS_SYSTEM_PROMPT = `You are a research assistant.
Return your response as STRICT JSON only, no markdown, no code fences, no tool mentions.
Output format:
{
  "blocks": [
    { "type": "title", "text": "..." },
    { "type": "section", "text": "Section title" },
    { "type": "paragraph", "text": "..." },
    { "type": "bullets", "title": "Optional", "items": ["...", "..."] },
    { "type": "table", "title": "Optional", "columns": ["..."], "rows": [["..."]] },
    { "type": "chart", "title": "Optional", "chart_type": "bar|line|pie", "labels": ["..."], "series": [{"name":"...", "data":[1,2]}] },
    { "type": "image", "title": "Optional", "description": "Optional", "prompt": "Optional", "url": "Optional" }
  ],
  "summary": "Optional short summary"
}
Use plain human-readable text in blocks. Do not include markdown.`;

export function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content.trim(),
  }));
}

export function parseJsonBlocks(raw: string): JsonBlocksResponse {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }
  const data = JSON.parse(text) as JsonBlocksResponse;
  if (!data.blocks || !Array.isArray(data.blocks)) {
    throw new Error('Invalid JSON blocks response');
  }
  return data;
}

