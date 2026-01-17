/**
 * Module Barrel Exports
 * Central export point for all analysis modules
 */

export { executeMarketDemand } from './market-demand.js';
export { executeRevenueIntelligence } from './revenue-intelligence.js';
export { executeCompetitiveIntelligence } from './competitive-intelligence.js';
export { executeSocialSentiment } from './social-sentiment.js';
export { executeFinancialModeling } from './financial-modeling.js';
export { executeRiskAssessment } from './risk-assessment.js';
export { executeOperationalFeasibility } from './operational-feasibility.js';

// Re-export module types for convenience
export type {
  ModuleExecutionContext,
  ModuleResult,
  MarketDemandData,
  RevenueIntelligenceData,
  CompetitiveIntelligenceData,
  SocialSentimentData,
  FinancialModelingData,
  RiskAssessmentData,
  OperationalFeasibilityData,
} from '../types/modules.js';
