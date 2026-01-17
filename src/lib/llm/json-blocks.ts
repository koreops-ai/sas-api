export type JsonBlock =
  | { type: 'title'; text: string }
  | { type: 'section'; title: string; content: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; title?: string; items: string[] }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] }
  | {
      type: 'chart';
      title?: string;
      chart_type: 'bar' | 'line' | 'pie';
      labels: string[];
      series: Array<{ name: string; data: number[] }>;
    }
  | { type: 'image'; title?: string; prompt: string; alt: string; url?: string };

export interface JsonBlocksOutput {
  blocks: JsonBlock[];
}

export function buildJsonBlocksSystemPrompt(): string {
  return [
    'You are a research analyst writing for non-technical readers.',
    'Return ONLY valid JSON. No markdown. No prose outside JSON.',
    'Do not mention tools or internal steps.',
    '',
    'Output format:',
    '{ "blocks": [ ... ] }',
    '',
    'Block types (use only these):',
    '- title: { type: "title", text }',
    '- section: { type: "section", title, content }',
    '- paragraph: { type: "paragraph", text }',
    '- bullets: { type: "bullets", title?, items[] }',
    '- table: { type: "table", title?, columns[], rows[][] }',
    '- chart: { type: "chart", title?, chart_type, labels[], series[] }',
    '- image: { type: "image", title?, prompt, alt, url? }',
    '',
    'Guidelines:',
    '- Keep content human readable and concise.',
    '- Use sections and bullets for clarity.',
    '- Include charts when numeric comparisons help.',
    '- Use image blocks as optional placeholders (no tool mention).',
  ].join('\n');
}

export function safeParseJsonBlocks(text: string): JsonBlocksOutput {
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
  }
  jsonText = jsonText.trim();

  const parsed = JSON.parse(jsonText) as JsonBlocksOutput;
  if (!parsed || !Array.isArray(parsed.blocks)) {
    throw new Error('Invalid JSON blocks output');
  }
  return parsed;
}
