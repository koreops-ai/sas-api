/**
 * Competitive Intelligence Module
 * Competitor analysis + SWOT generation
 *
 * Estimated time: 15-20 minutes
 * Can run in parallel: Yes
 */

import type {
  ModuleExecutionContext,
  ModuleResult,
  CompetitiveIntelligenceData,
  Competitor,
  MarketPositioning,
  CompetitiveLandscape,
} from '../types/modules.js';
import { sendMessageForJSON, generateSWOT } from '../lib/anthropic.js';
import { storeEvidence } from '../lib/supabase.js';

const SYSTEM_PROMPT = `You are a competitive intelligence analyst specializing in market research.
Your job is to identify and analyze competitors, their strengths, weaknesses, and market positioning.
Be specific and data-driven. Cite sources when possible.`;

export async function executeCompetitiveIntelligence(
  context: ModuleExecutionContext
): Promise<ModuleResult<CompetitiveIntelligenceData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];

  try {
    // Step 1: Identify competitors
    const competitorListResult = await identifyCompetitors(
      context.company_name,
      context.product_name,
      context.description,
      context.target_market
    );
    totalCost += competitorListResult.cost;

    // Step 2: Analyze each competitor (generate SWOT)
    const competitors: Competitor[] = [];
    for (const comp of competitorListResult.data.competitors) {
      const swotResult = await generateSWOT(comp);
      totalCost += swotResult.cost;

      competitors.push({
        ...comp,
        strengths: swotResult.swot.strengths,
        weaknesses: swotResult.swot.weaknesses,
        opportunities: swotResult.swot.opportunities,
        threats: swotResult.swot.threats,
      });
    }

    // Step 3: Generate market positioning
    const positioningResult = await analyzeMarketPositioning(
      competitors,
      context.company_name,
      context.product_name
    );
    totalCost += positioningResult.cost;

    // Step 4: Generate competitive landscape analysis
    const landscapeResult = await analyzeCompetitiveLandscape(
      competitors,
      context.company_name,
      context.product_name,
      context.target_market
    );
    totalCost += landscapeResult.cost;

    const data: CompetitiveIntelligenceData = {
      competitors,
      market_positioning: positioningResult.data,
      competitive_landscape: landscapeResult.data,
    };

    // Store evidence
    await storeEvidence({
      analysis_id: context.analysis_id,
      module_id: context.module_id,
      source_url: 'claude-analysis',
      source_type: 'api_response',
      content_type: 'application/json',
      storage_path: `analyses/${context.analysis_id}/competitive-intelligence.json`,
      metadata: {
        timestamp: new Date().toISOString(),
        competitors_count: competitors.length,
      },
    });

    return {
      success: true,
      data,
      error: null,
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error in competitive intelligence',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  }
}

async function identifyCompetitors(
  companyName: string,
  productName: string | null,
  description: string | null,
  targetMarket: string | null
): Promise<{
  data: { competitors: Omit<Competitor, 'strengths' | 'weaknesses' | 'opportunities' | 'threats'>[] };
  cost: number;
}> {
  const prompt = `Identify the top 5-8 competitors for:

Company: ${companyName}
${productName ? `Product: ${productName}` : ''}
${description ? `Description: ${description}` : ''}
${targetMarket ? `Target Market: ${targetMarket}` : ''}

For each competitor, provide:
- Company name
- Website URL
- Brief description
- Year founded (if known)
- Employee count range (if known)
- Funding status (if known)
- Estimated market share (if known)
- Pricing information
- Key features
- Target segments

Respond with JSON:
{
  "competitors": [
    {
      "name": "<company name>",
      "website": "<url>",
      "description": "<brief description>",
      "founded": <year or null>,
      "employees": "<range like '50-100' or null>",
      "funding": "<funding stage/amount or null>",
      "market_share": <percentage or null>,
      "pricing": {
        "model": "subscription" | "one_time" | "freemium" | "usage_based" | "tiered",
        "tiers": [
          {
            "name": "<tier name>",
            "price": <number>,
            "currency": "USD",
            "billing_period": "monthly" | "annually" | "one_time",
            "features": ["<feature1>", "<feature2>"]
          }
        ]
      },
      "key_features": ["<feature1>", "<feature2>"],
      "target_segments": ["<segment1>", "<segment2>"],
      "evidence_urls": ["<url1>", "<url2>"]
    }
  ]
}`;

  return sendMessageForJSON<{
    competitors: Omit<Competitor, 'strengths' | 'weaknesses' | 'opportunities' | 'threats'>[];
  }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
}

async function analyzeMarketPositioning(
  competitors: Competitor[],
  companyName: string,
  productName: string | null
): Promise<{ data: MarketPositioning; cost: number }> {
  const prompt = `Analyze the market positioning of competitors for ${companyName}${productName ? ` (${productName})` : ''}.

Competitors:
${JSON.stringify(competitors.map(c => ({ name: c.name, pricing: c.pricing, key_features: c.key_features })), null, 2)}

Provide:
1. Total number of significant competitors
2. Market leaders (top 2-3 by market share/brand recognition)
3. Emerging players (fast-growing or innovative)
4. Positioning map with each competitor plotted on:
   - X-axis: Price positioning (0=budget, 100=premium)
   - Y-axis: Feature richness (0=basic, 100=comprehensive)

Respond with JSON:
{
  "total_competitors": <number>,
  "market_leaders": ["<name1>", "<name2>"],
  "emerging_players": ["<name1>", "<name2>"],
  "positioning_map": [
    {
      "competitor": "<name>",
      "x_axis": <0-100>,
      "y_axis": <0-100>
    }
  ]
}`;

  return sendMessageForJSON<MarketPositioning>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });
}

async function analyzeCompetitiveLandscape(
  competitors: Competitor[],
  companyName: string,
  productName: string | null,
  targetMarket: string | null
): Promise<{ data: CompetitiveLandscape; cost: number }> {
  const prompt = `Analyze the competitive landscape for ${companyName}${productName ? ` (${productName})` : ''}${targetMarket ? ` in the ${targetMarket} market` : ''}.

Based on these competitors:
${JSON.stringify(competitors.map(c => ({ name: c.name, strengths: c.strengths, weaknesses: c.weaknesses })), null, 2)}

Identify:
1. Barriers to entry (what makes it hard for new players)
2. Key success factors (what winners do differently)
3. Market gaps (unmet needs or underserved segments)
4. Differentiation opportunities (how a new entrant could stand out)

Provide 3-5 items for each category.

Respond with JSON:
{
  "barriers_to_entry": ["<barrier1>", "<barrier2>"],
  "key_success_factors": ["<factor1>", "<factor2>"],
  "market_gaps": ["<gap1>", "<gap2>"],
  "differentiation_opportunities": ["<opportunity1>", "<opportunity2>"]
}`;

  return sendMessageForJSON<CompetitiveLandscape>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });
}
