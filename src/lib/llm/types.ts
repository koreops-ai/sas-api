export type LlmProvider = 'openai' | 'anthropic' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type JsonBlock =
  | {
      type: 'title' | 'section' | 'paragraph';
      text: string;
    }
  | {
      type: 'bullets';
      items: string[];
      title?: string;
    }
  | {
      type: 'table';
      title?: string;
      columns: string[];
      rows: string[][];
    }
  | {
      type: 'chart';
      title?: string;
      chart_type: 'bar' | 'line' | 'pie';
      labels: string[];
      series: Array<{ name: string; data: number[] }>;
    }
  | {
      type: 'image';
      title?: string;
      description?: string;
      prompt?: string;
      url?: string;
    };

export interface JsonBlocksResponse {
  blocks: JsonBlock[];
  summary?: string;
}

export interface ChatRequest {
  model_provider: LlmProvider;
  model?: string;
  messages: ChatMessage[];
  output_format: 'json_blocks';
}

