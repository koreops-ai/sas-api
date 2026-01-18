/**
 * Database types matching Supabase schema
 * SAS Market Validation Platform
 */

export type UserRole = 'admin' | 'team_lead' | 'analyst';

export type AnalysisStatus =
  | 'draft'
  | 'running'
  | 'hitl_pending'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ModuleType =
  | 'market_demand'
  | 'revenue_intelligence'
  | 'competitive_intelligence'
  | 'social_sentiment'
  | 'linkedin_contacts'
  | 'google_maps'
  | 'financial_modeling'
  | 'risk_assessment'
  | 'operational_feasibility';

export type ModuleStatus =
  | 'pending'
  | 'running'
  | 'hitl_pending'
  | 'approved'
  | 'revision_requested'
  | 'completed'
  | 'failed'
  | 'skipped';

export type SocialPlatform =
  | 'amazon_reviews'
  | 'reddit'
  | 'twitter'
  | 'trustpilot'
  | 'quora'
  | 'youtube';

export type HITLAction =
  | 'approve_all'
  | 'approve_selected'
  | 'request_revision'
  | 'reject';

// ============ USER & TEAM ============

export interface User {
  id: string;
  email: string;
  role: UserRole;
  team_id: string | null;
  credits_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

// ============ ANALYSIS ============

export interface Analysis {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  target_markets: string[] | null;
  website_url: string | null;
  company_name: string;
  product_name: string | null;
  status: AnalysisStatus;
  progress: number; // 0-100
  current_module: string | null;
  modules: ModuleType[];
  social_platforms: SocialPlatform[] | null;
  credits_estimated: number;
  credits_used: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisModule {
  id: string;
  analysis_id: string;
  module_type: ModuleType;
  status: ModuleStatus;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  cost: number;
  data: Record<string, unknown> | null;
  error: string | null;
}

// ============ HITL ============

export interface HITLCheckpoint {
  id: string;
  analysis_id: string;
  module_id: string;
  module_type: ModuleType;
  status: 'pending' | 'approved' | 'revision_requested' | 'rejected';
  data_snapshot: Record<string, unknown>;
  reviewer_id: string | null;
  reviewer_comment: string | null;
  action: HITLAction | null;
  adjustments: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
}

// ============ PRESETS ============

export interface Preset {
  id: string;
  name: string;
  description: string | null;
  user_id: string | null; // null = system preset
  team_id: string | null; // null = personal preset
  is_system: boolean;
  modules: ModuleType[];
  social_platforms: SocialPlatform[] | null;
  created_at: string;
}

// ============ CREDITS ============

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number; // positive = add, negative = deduct
  type: 'purchase' | 'analysis_cost' | 'refund' | 'adjustment';
  analysis_id: string | null;
  description: string;
  created_at: string;
}

// ============ EVIDENCE ============

export interface Evidence {
  id: string;
  analysis_id: string;
  module_id: string;
  source_url: string;
  source_type: 'screenshot' | 'api_response' | 'scraped_data';
  content_type: string;
  storage_path: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============ API REQUEST/RESPONSE ============

export interface CreateAnalysisRequest {
  name: string;
  company_name: string;
  product_name?: string;
  description?: string;
  target_market?: string;
  selected_modules: ModuleType[];
  social_platforms?: SocialPlatform[];
  preset_id?: string;
}

export interface AnalysisListResponse {
  data: Analysis[];
  total: number;
  limit: number;
  offset: number;
}

export interface HITLApprovalRequest {
  checkpoint_id: string;
  action: HITLAction;
  comment?: string;
  adjustments?: Record<string, unknown>;
}
