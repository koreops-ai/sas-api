/**
 * Request validation schemas using Zod
 * SAS Market Validation Platform
 */

import { z } from 'zod';
import type { ModuleType, SocialPlatform } from '../types/database.js';

/**
 * Create Analysis Request Schema
 */
export const createAnalysisSchema = z.object({
  name: z.string().min(1).max(200),
  company_name: z.string().min(1).max(200),
  product_name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  target_market: z.string().max(500).optional(),
  selected_modules: z.array(
    z.enum([
      'market_demand',
      'revenue_intelligence',
      'competitive_intelligence',
      'social_sentiment',
      'linkedin_contacts',
      'google_maps',
      'financial_modeling',
      'risk_assessment',
      'operational_feasibility',
    ])
  ).min(1),
  social_platforms: z
    .array(
      z.enum([
        'amazon_reviews',
        'reddit',
        'twitter',
        'trustpilot',
        'quora',
        'youtube',
      ])
    )
    .optional(),
  preset_id: z.string().uuid().optional(),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;

/**
 * HITL Approval Request Schema
 */
export const hitlApprovalSchema = z.object({
  checkpoint_id: z.string().uuid(),
  action: z.enum(['approve_all', 'approve_selected', 'request_revision', 'reject']),
  comment: z.string().max(1000).optional(),
  adjustments: z.record(z.unknown()).optional(),
});

export type HITLApprovalInput = z.infer<typeof hitlApprovalSchema>;

/**
 * Create Preset Request Schema
 */
export const createPresetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  team_id: z.string().uuid().optional(),
  modules: z.array(
    z.enum([
      'market_demand',
      'revenue_intelligence',
      'competitive_intelligence',
      'social_sentiment',
      'financial_modeling',
      'risk_assessment',
      'operational_feasibility',
    ])
  ).min(1),
  social_platforms: z
    .array(
      z.enum([
        'amazon_reviews',
        'reddit',
        'twitter',
        'trustpilot',
        'quora',
        'youtube',
      ])
    )
    .optional(),
});

export type CreatePresetInput = z.infer<typeof createPresetSchema>;

/**
 * Update Preset Request Schema
 */
export const updatePresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  modules: z.array(
    z.enum([
      'market_demand',
      'revenue_intelligence',
      'competitive_intelligence',
      'social_sentiment',
      'financial_modeling',
      'risk_assessment',
      'operational_feasibility',
    ])
  ).min(1).optional(),
  social_platforms: z
    .array(
      z.enum([
        'amazon_reviews',
        'reddit',
        'twitter',
        'trustpilot',
        'quora',
        'youtube',
      ])
    )
    .optional(),
});

export type UpdatePresetInput = z.infer<typeof updatePresetSchema>;

/**
 * Chat Request Schema
 */
export const chatRequestSchema = z.object({
  model_provider: z.enum(['openai', 'anthropic', 'gemini']),
  model: z.string().optional(),
  output_format: z.literal('json_blocks'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1),
      })
    )
    .min(1),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
