/**
 * Module-specific types for analysis execution
 * SAS Market Validation Platform
 */

import type { SocialPlatform } from './database.js';

// ============ MARKET & DEMAND ============

export interface MarketDemandData {
  tam: {
    value: number;
    currency: string;
    source: string;
    confidence: number;
  };
  sam: {
    value: number;
    currency: string;
    source: string;
    confidence: number;
  };
  som: {
    value: number;
    currency: string;
    rationale: string;
  };
  growth_rate: {
    cagr: number;
    period: string;
    source: string;
  };
  keywords: KeywordData[];
  trends: TrendData[];
}

export interface KeywordData {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: 'low' | 'medium' | 'high';
  trend: 'rising' | 'stable' | 'declining';
}

export interface TrendData {
  term: string;
  interest_over_time: number[];
  related_queries: string[];
}

// ============ REVENUE INTELLIGENCE ============

export interface RevenueIntelligenceData {
  products: ScrapedProduct[];
  market_aggregation: MarketAggregation;
  platform_breakdown: PlatformBreakdown[];
}

export interface ScrapedProduct {
  name: string;
  provider: string;
  price: number;
  original_price: number | null;
  currency: string;
  review_count: number;
  average_rating: number;
  rating_distribution: Record<string, number>;
  enrollment_count: number | null;
  date_listed: string | null;
  last_updated: string | null;
  category: string;
  tags: string[];
  url: string;
  screenshot_path: string;
  platform: string;
  multiplier_used: number;
  estimated_units: number;
  estimated_revenue: number;
}

export interface MarketAggregation {
  observable_market: number;
  coverage_factor: number;
  estimated_tam: number;
  total_products_scraped: number;
  scrape_depth: 'top_10' | 'top_50' | 'top_100' | 'full_category';
}

export interface PlatformBreakdown {
  platform: string;
  category: string;
  products_count: number;
  total_reviews: number;
  total_revenue: number;
  average_price: number;
  multiplier: {
    conservative: number;
    moderate: number;
    aggressive: number;
    selected: number;
  };
}

// Platform multipliers from spec
export const PLATFORM_MULTIPLIERS = {
  // Category 1: Mandatory Feedback (1×)
  skillsfuture_mandated: { conservative: 1, moderate: 1, aggressive: 1 },
  skillsfuture_general: { conservative: 1, moderate: 1.2, aggressive: 1.5 },
  wsq_certified: { conservative: 1, moderate: 1, aggressive: 1.2 },
  government_portals: { conservative: 1, moderate: 1.2, aggressive: 1.5 },

  // Category 2: Online Courses (5-25×)
  udemy: { conservative: 5, moderate: 10, aggressive: 25 },
  coursera: { conservative: 5, moderate: 10, aggressive: 20 },
  skillshare: { conservative: 5, moderate: 10, aggressive: 20 },

  // Category 3: E-commerce (10-100×)
  amazon: { conservative: 33, moderate: 50, aggressive: 100 },
  general_ecommerce: { conservative: 10, moderate: 20, aggressive: 50 },
  trustpilot: { conservative: 7, moderate: 10, aggressive: 20 },

  // Category 4: B2B Software (7-50×)
  g2: { conservative: 7, moderate: 20, aggressive: 50 },
  capterra: { conservative: 7, moderate: 20, aggressive: 50 },
  trustradius: { conservative: 7, moderate: 20, aggressive: 50 },

  // Category 5: App Stores (67-1000×)
  ios_app_store: { conservative: 67, moderate: 200, aggressive: 1000 },
  google_play: { conservative: 67, moderate: 200, aggressive: 1000 },

  // Category 6: Service Marketplaces (2-4×)
  fiverr: { conservative: 2, moderate: 3, aggressive: 4 },
  upwork: { conservative: 2, moderate: 3, aggressive: 4 },
} as const;

export const COVERAGE_FACTORS = {
  top_10: { min: 0.20, max: 0.30, tam_multiplier_min: 4, tam_multiplier_max: 5 },
  top_50: { min: 0.50, max: 0.60, tam_multiplier_min: 1.7, tam_multiplier_max: 2 },
  top_100: { min: 0.70, max: 0.80, tam_multiplier_min: 1.25, tam_multiplier_max: 1.4 },
  full_category: { min: 0.85, max: 0.95, tam_multiplier_min: 1.1, tam_multiplier_max: 1.2 },
} as const;

// ============ COMPETITIVE INTELLIGENCE ============

export interface CompetitiveIntelligenceData {
  competitors: Competitor[];
  market_positioning: MarketPositioning;
  competitive_landscape: CompetitiveLandscape;
}

export interface Competitor {
  name: string;
  website: string;
  description: string;
  founded: number | null;
  employees: string | null;
  funding: string | null;
  market_share: number | null;
  pricing: PricingInfo | null;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  key_features: string[];
  target_segments: string[];
  evidence_urls: string[];
}

export interface PricingInfo {
  model: 'subscription' | 'one_time' | 'freemium' | 'usage_based' | 'tiered';
  tiers: PricingTier[];
}

export interface PricingTier {
  name: string;
  price: number;
  currency: string;
  billing_period: 'monthly' | 'annually' | 'one_time';
  features: string[];
}

export interface MarketPositioning {
  total_competitors: number;
  market_leaders: string[];
  emerging_players: string[];
  positioning_map: PositioningPoint[];
}

export interface PositioningPoint {
  competitor: string;
  x_axis: number; // e.g., price (0-100)
  y_axis: number; // e.g., features (0-100)
}

export interface CompetitiveLandscape {
  barriers_to_entry: string[];
  key_success_factors: string[];
  market_gaps: string[];
  differentiation_opportunities: string[];
}

// ============ SOCIAL SENTIMENT ============

export interface SocialSentimentData {
  platforms: PlatformSentiment[];
  overall_sentiment: SentimentScore;
  key_themes: Theme[];
  notable_mentions: Mention[];
}

export interface PlatformSentiment {
  platform: SocialPlatform;
  posts_analyzed: number;
  sentiment_score: SentimentScore;
  top_positive: string[];
  top_negative: string[];
  sample_posts: SamplePost[];
}

export interface SentimentScore {
  positive: number; // 0-100
  neutral: number;
  negative: number;
  compound: number; // -1 to 1
}

export interface Theme {
  theme: string;
  frequency: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sample_quotes: string[];
}

export interface Mention {
  platform: SocialPlatform;
  content: string;
  url: string;
  date: string;
  engagement: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface SamplePost {
  content: string;
  url: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  engagement: number;
}

// ============ FINANCIAL MODELING ============

export interface FinancialModelingData {
  unit_economics: UnitEconomics;
  revenue_projections: RevenueProjection[];
  cost_structure: CostStructure;
  break_even_analysis: BreakEvenAnalysis;
  exit_valuation: ExitValuation;
}

export interface UnitEconomics {
  average_revenue_per_user: number;
  customer_acquisition_cost: number;
  lifetime_value: number;
  ltv_cac_ratio: number;
  gross_margin: number;
  contribution_margin: number;
  payback_period_months: number;
}

export interface RevenueProjection {
  year: number;
  revenue: number;
  customers: number;
  growth_rate: number;
  assumptions: string[];
}

export interface CostStructure {
  fixed_costs: CostItem[];
  variable_costs: CostItem[];
  total_monthly_fixed: number;
  variable_cost_per_unit: number;
}

export interface CostItem {
  name: string;
  amount: number;
  frequency: 'monthly' | 'annually' | 'one_time';
  category: 'personnel' | 'technology' | 'marketing' | 'operations' | 'other';
}

export interface BreakEvenAnalysis {
  break_even_units: number;
  break_even_revenue: number;
  months_to_break_even: number;
  assumptions: string[];
}

export interface ExitValuation {
  method: string;
  revenue_multiple: number;
  ebitda_multiple: number;
  year_5_valuation: number;
  comparable_exits: ComparableExit[];
}

export interface ComparableExit {
  company: string;
  exit_value: number;
  revenue_at_exit: number;
  multiple: number;
  year: number;
}

// ============ RISK ASSESSMENT ============

export interface RiskAssessmentData {
  risks: Risk[];
  risk_matrix: RiskMatrixCell[][];
  overall_risk_score: number;
  key_mitigations: Mitigation[];
}

export interface Risk {
  id: string;
  category: 'market' | 'competitive' | 'operational' | 'financial' | 'regulatory' | 'technical';
  name: string;
  description: string;
  likelihood: 1 | 2 | 3 | 4 | 5; // 1=rare, 5=almost certain
  impact: 1 | 2 | 3 | 4 | 5; // 1=negligible, 5=catastrophic
  risk_score: number; // likelihood × impact
  mitigations: Mitigation[];
}

export interface Mitigation {
  risk_id: string;
  strategy: string;
  cost_estimate: number | null;
  effectiveness: 'high' | 'medium' | 'low';
  timeline: string;
}

export interface RiskMatrixCell {
  likelihood: number;
  impact: number;
  risk_ids: string[];
  color: 'green' | 'yellow' | 'orange' | 'red';
}

// ============ OPERATIONAL FEASIBILITY ============

export interface OperationalFeasibilityData {
  resource_requirements: ResourceRequirements;
  timeline: ProjectTimeline;
  dependencies: Dependency[];
  feasibility_score: number;
  go_no_go_recommendation: 'go' | 'conditional_go' | 'no_go';
  conditions: string[];
}

export interface ResourceRequirements {
  team_size: number;
  key_roles: RoleRequirement[];
  technology_stack: string[];
  infrastructure_needs: string[];
  estimated_monthly_burn: number;
}

export interface RoleRequirement {
  role: string;
  count: number;
  skills: string[];
  estimated_salary: number;
}

export interface ProjectTimeline {
  total_months: number;
  phases: ProjectPhase[];
  milestones: Milestone[];
}

export interface ProjectPhase {
  name: string;
  duration_months: number;
  deliverables: string[];
  dependencies: string[];
}

export interface Milestone {
  name: string;
  target_date: string;
  criteria: string[];
}

export interface Dependency {
  name: string;
  type: 'internal' | 'external' | 'technical' | 'regulatory';
  status: 'resolved' | 'pending' | 'blocked';
  impact: 'critical' | 'high' | 'medium' | 'low';
  resolution_plan: string;
}

// ============ MODULE EXECUTION CONTEXT ============

export interface ModuleExecutionContext {
  analysis_id: string;
  module_id: string;
  company_name: string;
  product_name: string | null;
  description: string | null;
  target_market: string | null;
  social_platforms?: SocialPlatform[];
  prior_module_data?: Record<string, unknown>;
}

export interface ModuleResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  cost: number;
  duration_ms: number;
  evidence_paths: string[];
}
