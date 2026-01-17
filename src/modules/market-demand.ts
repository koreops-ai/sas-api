/**
 * Market & Demand Analysis Module
 * Analyzes TAM/SAM/SOM + Keyword research
 *
 * Estimated time: 10-15 minutes
 * Can run in parallel: Yes
 */

import type {
  ModuleExecutionContext,
  ModuleResult,
  MarketDemandData,
  KeywordData,
  TrendData,
} from '../types/modules.js';
import { sendMessageForJSON } from '../lib/anthropic.js';
import { storeEvidence, uploadEvidence } from '../lib/supabase.js';

const SYSTEM_PROMPT = `You are a market research analyst specializing in TAM/SAM/SOM analysis and keyword research.
Your job is to analyze market potential for products and services.
Always cite your sources and provide confidence levels for your estimates.
Focus on finding data from authoritative sources (.gov, .org, industry reports).`;

interface MarketResearchPrompt {
  company_name: string;
  product_name: string | null;
  description: string | null;
  target_market: string | null;
}

export async function executeMarketDemand(
  context: ModuleExecutionContext
): Promise<ModuleResult<MarketDemandData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];

  try {
    // Step 1: Market Size Analysis (TAM/SAM/SOM)
    const marketSizeResult = await analyzeMarketSize({
      company_name: context.company_name,
      product_name: context.product_name,
      description: context.description,
      target_market: context.target_market,
    });
    totalCost += marketSizeResult.cost;

    // Step 2: Keyword Research
    const keywordResult = await performKeywordResearch({
      company_name: context.company_name,
      product_name: context.product_name,
      description: context.description,
      target_market: context.target_market,
    });
    totalCost += keywordResult.cost;

    // Step 3: Trend Analysis
    const trendResult = await analyzeTrends({
      company_name: context.company_name,
      product_name: context.product_name,
      target_market: context.target_market,
    });
    totalCost += trendResult.cost;

    // Combine results
    const data: MarketDemandData = {
      tam: marketSizeResult.data.tam,
      sam: marketSizeResult.data.sam,
      som: marketSizeResult.data.som,
      growth_rate: marketSizeResult.data.growth_rate,
      keywords: keywordResult.data.keywords,
      trends: trendResult.data.trends,
    };

    // Store evidence
    const evidenceRecord = await storeEvidence({
      analysis_id: context.analysis_id,
      module_id: context.module_id,
      source_url: 'claude-analysis',
      source_type: 'api_response',
      content_type: 'application/json',
      storage_path: `analyses/${context.analysis_id}/market-demand-data.json`,
      metadata: {
        timestamp: new Date().toISOString(),
        company: context.company_name,
        product: context.product_name,
      },
    });

    if (evidenceRecord) {
      evidencePaths.push(evidenceRecord.storage_path);
    }

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
      error: error instanceof Error ? error.message : 'Unknown error in market demand analysis',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  }
}

async function analyzeMarketSize(input: MarketResearchPrompt): Promise<{
  data: {
    tam: MarketDemandData['tam'];
    sam: MarketDemandData['sam'];
    som: MarketDemandData['som'];
    growth_rate: MarketDemandData['growth_rate'];
  };
  cost: number;
}> {
  const prompt = `Analyze the market size for the following business:

Company: ${input.company_name}
${input.product_name ? `Product: ${input.product_name}` : ''}
${input.description ? `Description: ${input.description}` : ''}
${input.target_market ? `Target Market: ${input.target_market}` : ''}

Provide TAM (Total Addressable Market), SAM (Serviceable Addressable Market), and SOM (Serviceable Obtainable Market) estimates.

For each estimate:
1. Provide the value in USD
2. Cite your source (prefer .gov, industry reports, research firms)
3. Provide a confidence level (0.0 to 1.0)

Also estimate the market growth rate (CAGR) with the time period.

Respond with JSON in this exact format:
{
  "tam": {
    "value": <number in USD>,
    "currency": "USD",
    "source": "<source citation>",
    "confidence": <0.0-1.0>
  },
  "sam": {
    "value": <number in USD>,
    "currency": "USD",
    "source": "<source citation>",
    "confidence": <0.0-1.0>
  },
  "som": {
    "value": <number in USD>,
    "currency": "USD",
    "rationale": "<explanation of how this was calculated>"
  },
  "growth_rate": {
    "cagr": <percentage as decimal, e.g., 0.15 for 15%>,
    "period": "<e.g., 2024-2028>",
    "source": "<source citation>"
  }
}`;

  const result = await sendMessageForJSON<{
    tam: MarketDemandData['tam'];
    sam: MarketDemandData['sam'];
    som: MarketDemandData['som'];
    growth_rate: MarketDemandData['growth_rate'];
  }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });

  return {
    data: result.data,
    cost: result.cost,
  };
}

async function performKeywordResearch(input: MarketResearchPrompt): Promise<{
  data: { keywords: KeywordData[] };
  cost: number;
}> {
  const prompt = `Perform keyword research for the following business:

Company: ${input.company_name}
${input.product_name ? `Product: ${input.product_name}` : ''}
${input.description ? `Description: ${input.description}` : ''}
${input.target_market ? `Target Market: ${input.target_market}` : ''}

Identify 15-20 high-value keywords that potential customers might search for.
Include:
- Commercial intent keywords (people ready to buy)
- Informational keywords (people researching)
- Competitor comparison keywords
- Problem/solution keywords

For each keyword, estimate:
- Monthly search volume
- CPC (cost per click in USD)
- Competition level (low/medium/high)
- Trend (rising/stable/declining)

Respond with JSON:
{
  "keywords": [
    {
      "keyword": "<keyword phrase>",
      "search_volume": <estimated monthly searches>,
      "cpc": <estimated CPC in USD>,
      "competition": "low" | "medium" | "high",
      "trend": "rising" | "stable" | "declining"
    }
  ]
}`;

  const result = await sendMessageForJSON<{ keywords: KeywordData[] }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });

  return {
    data: result.data,
    cost: result.cost,
  };
}

async function analyzeTrends(input: {
  company_name: string;
  product_name: string | null;
  target_market: string | null;
}): Promise<{
  data: { trends: TrendData[] };
  cost: number;
}> {
  const prompt = `Analyze market trends for:

Company: ${input.company_name}
${input.product_name ? `Product: ${input.product_name}` : ''}
${input.target_market ? `Target Market: ${input.target_market}` : ''}

Identify 5-8 key market trends that could impact this business.
For each trend, provide:
- The trend term/topic
- Interest over time (simulated 12-month trend as array of 12 values 0-100)
- Related search queries

Respond with JSON:
{
  "trends": [
    {
      "term": "<trend topic>",
      "interest_over_time": [<12 monthly values from 0-100>],
      "related_queries": ["<query1>", "<query2>", ...]
    }
  ]
}`;

  const result = await sendMessageForJSON<{ trends: TrendData[] }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });

  return {
    data: result.data,
    cost: result.cost,
  };
}
