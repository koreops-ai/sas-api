/**
 * Financial Modeling Module
 * Unit economics + Exit valuation
 *
 * Estimated time: 5-8 minutes
 * Depends on: Market & Demand OR Revenue Intelligence data
 */

import type {
  ModuleExecutionContext,
  ModuleResult,
  FinancialModelingData,
  UnitEconomics,
  RevenueProjection,
  CostStructure,
  BreakEvenAnalysis,
  ExitValuation,
  MarketDemandData,
  RevenueIntelligenceData,
} from '../types/modules.js';
import { generateFinancialModel, sendMessageForJSON } from '../lib/anthropic.js';
import { storeEvidence } from '../lib/supabase.js';

const SYSTEM_PROMPT = `You are a financial analyst specializing in startup and SaaS financial modeling.
You create detailed unit economics, revenue projections, and valuation models.
Always show your assumptions and calculations clearly.
Be realistic but optimistic - show both conservative and aggressive scenarios.`;

export async function executeFinancialModeling(
  context: ModuleExecutionContext
): Promise<ModuleResult<FinancialModelingData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];

  try {
    // Extract prior module data
    const marketData = context.prior_module_data?.market_demand as MarketDemandData | undefined;
    const revenueData = context.prior_module_data?.revenue_intelligence as RevenueIntelligenceData | undefined;

    if (!marketData && !revenueData) {
      return {
        success: false,
        data: null,
        error: 'Financial modeling requires Market & Demand or Revenue Intelligence data',
        cost: 0,
        duration_ms: Date.now() - startTime,
        evidence_paths: [],
      };
    }

    // Step 1: Generate unit economics
    const unitEconomicsResult = await calculateUnitEconomics(
      context.company_name,
      context.product_name,
      context.target_market,
      marketData,
      revenueData
    );
    totalCost += unitEconomicsResult.cost;

    // Step 2: Generate revenue projections
    const projectionsResult = await generateRevenueProjections(
      unitEconomicsResult.data,
      marketData,
      revenueData
    );
    totalCost += projectionsResult.cost;

    // Step 3: Calculate cost structure
    const costStructureResult = await estimateCostStructure(
      context.company_name,
      context.product_name,
      unitEconomicsResult.data
    );
    totalCost += costStructureResult.cost;

    // Step 4: Break-even analysis
    const breakEvenResult = await calculateBreakEven(
      unitEconomicsResult.data,
      costStructureResult.data
    );
    totalCost += breakEvenResult.cost;

    // Step 5: Exit valuation
    const exitResult = await calculateExitValuation(
      projectionsResult.data,
      context.company_name,
      context.target_market
    );
    totalCost += exitResult.cost;

    const data: FinancialModelingData = {
      unit_economics: unitEconomicsResult.data,
      revenue_projections: projectionsResult.data,
      cost_structure: costStructureResult.data,
      break_even_analysis: breakEvenResult.data,
      exit_valuation: exitResult.data,
    };

    // Store evidence
    await storeEvidence({
      analysis_id: context.analysis_id,
      module_id: context.module_id,
      source_url: 'financial-model',
      source_type: 'api_response',
      content_type: 'application/json',
      storage_path: `analyses/${context.analysis_id}/financial-model.json`,
      metadata: {
        timestamp: new Date().toISOString(),
        year_5_revenue: projectionsResult.data[4]?.revenue || 0,
        break_even_months: breakEvenResult.data.months_to_break_even,
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
      error: error instanceof Error ? error.message : 'Unknown error in financial modeling',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  }
}

async function calculateUnitEconomics(
  companyName: string,
  productName: string | null,
  targetMarket: string | null,
  marketData?: MarketDemandData,
  revenueData?: RevenueIntelligenceData
): Promise<{ data: UnitEconomics; cost: number }> {
  const prompt = `Calculate unit economics for ${companyName}${productName ? ` (${productName})` : ''}${targetMarket ? ` in ${targetMarket}` : ''}.

${marketData ? `Market Data:\n- TAM: $${marketData.tam.value.toLocaleString()}\n- SAM: $${marketData.sam.value.toLocaleString()}\n- Growth Rate: ${(marketData.growth_rate.cagr * 100).toFixed(1)}%` : ''}

${revenueData ? `Revenue Intelligence:\n- Observable Market: $${revenueData.market_aggregation.observable_market.toLocaleString()}\n- Average Product Price: $${Math.round(revenueData.platform_breakdown.reduce((s, p) => s + p.average_price, 0) / revenueData.platform_breakdown.length)}` : ''}

Calculate:
1. ARPU (Average Revenue Per User) - based on typical pricing for this market
2. CAC (Customer Acquisition Cost) - typical for this industry/market
3. LTV (Lifetime Value) - based on churn and ARPU
4. LTV:CAC Ratio
5. Gross Margin - typical for this business model
6. Contribution Margin
7. Payback Period (months)

Respond with JSON:
{
  "average_revenue_per_user": <monthly ARPU in USD>,
  "customer_acquisition_cost": <CAC in USD>,
  "lifetime_value": <LTV in USD>,
  "ltv_cac_ratio": <ratio like 3.0>,
  "gross_margin": <percentage as decimal like 0.70>,
  "contribution_margin": <percentage as decimal>,
  "payback_period_months": <number of months>
}`;

  return sendMessageForJSON<UnitEconomics>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });
}

async function generateRevenueProjections(
  unitEconomics: UnitEconomics,
  marketData?: MarketDemandData,
  revenueData?: RevenueIntelligenceData
): Promise<{ data: RevenueProjection[]; cost: number }> {
  const som = marketData?.som.value || revenueData?.market_aggregation.observable_market || 1000000;
  const growthRate = marketData?.growth_rate.cagr || 0.15;

  const prompt = `Create a 5-year revenue projection model with these inputs:

Unit Economics:
- ARPU: $${unitEconomics.average_revenue_per_user}/month
- CAC: $${unitEconomics.customer_acquisition_cost}
- LTV: $${unitEconomics.lifetime_value}

Market:
- SOM (Serviceable Obtainable Market): $${som.toLocaleString()}
- Market Growth Rate: ${(growthRate * 100).toFixed(1)}%

Create projections for Years 1-5 showing:
- Annual revenue
- Customer count
- YoY growth rate
- Key assumptions for that year

Start conservatively in Year 1 and show realistic scaling.

Respond with JSON:
{
  "projections": [
    {
      "year": 1,
      "revenue": <annual revenue USD>,
      "customers": <total customers>,
      "growth_rate": <YoY growth as decimal, 0 for year 1>,
      "assumptions": ["<assumption1>", "<assumption2>"]
    }
  ]
}`;

  const result = await sendMessageForJSON<{ projections: RevenueProjection[] }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });

  return {
    data: result.data.projections,
    cost: result.cost,
  };
}

async function estimateCostStructure(
  companyName: string,
  productName: string | null,
  unitEconomics: UnitEconomics
): Promise<{ data: CostStructure; cost: number }> {
  const prompt = `Estimate the cost structure for a startup like ${companyName}${productName ? ` (${productName})` : ''}.

Given:
- Gross Margin: ${(unitEconomics.gross_margin * 100).toFixed(0)}%
- ARPU: $${unitEconomics.average_revenue_per_user}/month

Provide:
1. Fixed costs (personnel, office, software, etc.)
2. Variable costs (per customer/transaction)

Be realistic for an early-stage startup scaling up.

Respond with JSON:
{
  "fixed_costs": [
    {
      "name": "<cost item>",
      "amount": <USD>,
      "frequency": "monthly" | "annually" | "one_time",
      "category": "personnel" | "technology" | "marketing" | "operations" | "other"
    }
  ],
  "variable_costs": [
    {
      "name": "<cost item>",
      "amount": <USD per unit>,
      "frequency": "monthly",
      "category": "personnel" | "technology" | "marketing" | "operations" | "other"
    }
  ],
  "total_monthly_fixed": <sum of monthly fixed costs>,
  "variable_cost_per_unit": <variable cost per customer/unit>
}`;

  return sendMessageForJSON<CostStructure>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });
}

async function calculateBreakEven(
  unitEconomics: UnitEconomics,
  costStructure: CostStructure
): Promise<{ data: BreakEvenAnalysis; cost: number }> {
  const prompt = `Calculate break-even analysis:

Unit Economics:
- ARPU: $${unitEconomics.average_revenue_per_user}/month
- Contribution Margin: ${(unitEconomics.contribution_margin * 100).toFixed(0)}%

Cost Structure:
- Monthly Fixed Costs: $${costStructure.total_monthly_fixed.toLocaleString()}
- Variable Cost per Unit: $${costStructure.variable_cost_per_unit}

Calculate:
1. Break-even units (customers needed)
2. Break-even revenue (annual)
3. Estimated months to break-even (assuming reasonable growth)
4. Key assumptions

Respond with JSON:
{
  "break_even_units": <number of customers>,
  "break_even_revenue": <annual revenue at break-even>,
  "months_to_break_even": <estimated months>,
  "assumptions": ["<assumption1>", "<assumption2>"]
}`;

  return sendMessageForJSON<BreakEvenAnalysis>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 2048,
  });
}

async function calculateExitValuation(
  projections: RevenueProjection[],
  companyName: string,
  targetMarket: string | null
): Promise<{ data: ExitValuation; cost: number }> {
  const year5Revenue = projections[4]?.revenue || 0;

  const prompt = `Calculate exit valuation scenarios for ${companyName}${targetMarket ? ` in ${targetMarket}` : ''}.

Year 5 Projected Revenue: $${year5Revenue.toLocaleString()}

Provide:
1. Valuation method used
2. Revenue multiple (typical for this industry)
3. EBITDA multiple (if applicable)
4. Year 5 valuation estimate
5. 3-5 comparable exits in this industry

Respond with JSON:
{
  "method": "<valuation methodology>",
  "revenue_multiple": <typical revenue multiple like 5.0>,
  "ebitda_multiple": <typical EBITDA multiple like 15.0>,
  "year_5_valuation": <estimated valuation>,
  "comparable_exits": [
    {
      "company": "<company name>",
      "exit_value": <exit value USD>,
      "revenue_at_exit": <revenue at exit>,
      "multiple": <revenue multiple achieved>,
      "year": <year of exit>
    }
  ]
}`;

  return sendMessageForJSON<ExitValuation>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });
}
