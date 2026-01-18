/**
 * Analysis Module Suggestions
 * POST /api/analyses/suggest-modules
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  setCorsHeaders,
  handleOptions,
  getRequestBody,
} from '../../src/lib/api.js';
import { runJsonCompletion } from '../../src/lib/llm/structured.js';
import { SYNTHESIS_CONFIG } from '../../src/lib/agents/registry.js';

interface SuggestRequest {
  decision_question?: string;
  company_name: string;
  product_name?: string;
  description?: string;
  target_market?: string;
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  await requireAuth(req);
  const body = await getRequestBody<SuggestRequest>(req);
  if (!body || !body.company_name) {
    sendError(res, 'company_name is required', 400);
    return;
  }

  const systemPrompt =
    'You are an analyst helping select research modules. Respond with JSON only.';
  const userPrompt = `Decision Question: ${body.decision_question ?? 'N/A'}
Company: ${body.company_name}
Product: ${body.product_name ?? 'N/A'}
Target Market: ${body.target_market ?? 'N/A'}
Description: ${body.description ?? 'N/A'}

Available modules:
- market_demand
- revenue_intelligence
- competitive_intelligence
- social_sentiment
- linkedin_contacts
- google_maps
- financial_modeling
- risk_assessment
- operational_feasibility

Return JSON:
{
  "recommended_modules": ["module", "..."],
  "recommended_social_platforms": ["reddit", "twitter", "youtube"],
  "rationale": "..."
}`;

  const result = await runJsonCompletion<{
    recommended_modules: string[];
    recommended_social_platforms?: string[];
    rationale: string;
  }>(SYNTHESIS_CONFIG.provider, SYNTHESIS_CONFIG.model, systemPrompt, userPrompt);

  sendSuccess(res, result.data);
}

export default asyncHandler(handler);
