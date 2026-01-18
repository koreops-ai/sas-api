import type { LlmProvider } from '../llm/types.js';
import type { ModuleType, SocialPlatform } from '../../types/database.js';

export type AgentType =
  | 'keywords_agent'
  | 'sentiment_agent'
  | 'web_research_agent'
  | 'linkedin_contact_agent'
  | 'google_maps_agent';

export interface AgentContext {
  analysis_id: string;
  module_id: string;
  module_type: ModuleType;
  company_name: string;
  product_name: string | null;
  description: string | null;
  target_market: string | null;
  social_platforms?: SocialPlatform[];
  prior_module_data?: Record<string, unknown>;
  analysis_memory?: string | null;
  agent_memory?: string | null;
}

export interface AgentResult {
  agent: AgentType;
  summary: string;
  data: Record<string, unknown>;
  sources: string[];
  evidence_paths: string[];
  cost: number;
  duration_ms: number;
  provider: LlmProvider;
  model: string;
}

export interface ModuleSynthesisResult {
  summary: string;
  highlights: string[];
  risks: string[];
  recommendations: string[];
  citations: string[];
  cost: number;
}

export interface GlobalSynthesisResult {
  executive_summary: string;
  go_no_go: 'go' | 'conditional_go' | 'no_go';
  key_reasons: string[];
  risks: string[];
  next_steps: string[];
  citations: string[];
  cost: number;
}
