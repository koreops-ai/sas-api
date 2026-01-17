/**
 * Risk Assessment Module
 * Risk matrix + Mitigation strategies
 *
 * Estimated time: 5-8 minutes
 * Benefits from: All prior module data
 */

import type {
  ModuleExecutionContext,
  ModuleResult,
  RiskAssessmentData,
  Risk,
  Mitigation,
  RiskMatrixCell,
} from '../types/modules.js';
import { generateRiskAssessment, sendMessageForJSON } from '../lib/anthropic.js';
import { storeEvidence } from '../lib/supabase.js';

const SYSTEM_PROMPT = `You are a risk management expert specializing in startup and market entry risk assessment.
You identify, categorize, and score risks, then recommend practical mitigation strategies.
Be thorough but practical - focus on actionable risks and realistic mitigations.`;

const RISK_COLORS: Record<number, 'green' | 'yellow' | 'orange' | 'red'> = {
  1: 'green',
  2: 'green',
  3: 'green',
  4: 'yellow',
  5: 'yellow',
  6: 'yellow',
  8: 'orange',
  9: 'orange',
  10: 'orange',
  12: 'orange',
  15: 'red',
  16: 'red',
  20: 'red',
  25: 'red',
};

export async function executeRiskAssessment(
  context: ModuleExecutionContext
): Promise<ModuleResult<RiskAssessmentData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];

  try {
    // Step 1: Identify risks based on all available data
    const risksResult = await identifyRisks(
      context.company_name,
      context.product_name,
      context.target_market,
      context.prior_module_data || {}
    );
    totalCost += risksResult.cost;

    // Step 2: Score and categorize risks (with empty mitigations for now)
    const scoredRisks = risksResult.data.risks.map((risk) => ({
      ...risk,
      risk_score: risk.likelihood * risk.impact,
      mitigations: [] as Risk['mitigations'], // Will be populated in Step 4
    }));

    // Step 3: Generate risk matrix (before mitigations are added)
    const riskMatrix = generateRiskMatrix(scoredRisks);

    // Step 4: Generate mitigation strategies
    const mitigationsResult = await generateMitigations(scoredRisks);
    totalCost += mitigationsResult.cost;

    // Apply mitigations to risks
    const risksWithMitigations: Risk[] = scoredRisks.map((risk) => ({
      ...risk,
      mitigations: mitigationsResult.data.mitigations.filter(
        (m) => m.risk_id === risk.id
      ),
    }));

    // Calculate overall risk score (weighted average of top risks)
    const overallRiskScore = calculateOverallRiskScore(risksWithMitigations);

    // Extract key mitigations (most impactful)
    const keyMitigations = mitigationsResult.data.mitigations
      .filter((m) => m.effectiveness === 'high')
      .slice(0, 5);

    const data: RiskAssessmentData = {
      risks: risksWithMitigations,
      risk_matrix: riskMatrix,
      overall_risk_score: overallRiskScore,
      key_mitigations: keyMitigations,
    };

    // Store evidence
    await storeEvidence({
      analysis_id: context.analysis_id,
      module_id: context.module_id,
      source_url: 'risk-assessment',
      source_type: 'api_response',
      content_type: 'application/json',
      storage_path: `analyses/${context.analysis_id}/risk-assessment.json`,
      metadata: {
        timestamp: new Date().toISOString(),
        total_risks: risksWithMitigations.length,
        overall_score: overallRiskScore,
        high_risks: risksWithMitigations.filter((r) => r.risk_score >= 15).length,
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
      error: error instanceof Error ? error.message : 'Unknown error in risk assessment',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  }
}

async function identifyRisks(
  companyName: string,
  productName: string | null,
  targetMarket: string | null,
  priorData: Record<string, unknown>
): Promise<{
  data: {
    risks: Array<{
      id: string;
      category: Risk['category'];
      name: string;
      description: string;
      likelihood: 1 | 2 | 3 | 4 | 5;
      impact: 1 | 2 | 3 | 4 | 5;
    }>;
  };
  cost: number;
}> {
  const priorDataSummary = Object.keys(priorData).length > 0
    ? `\n\nPrior Analysis Data Available:\n${JSON.stringify(priorData, null, 2).slice(0, 3000)}...`
    : '';

  const prompt = `Identify key risks for entering the market as ${companyName}${productName ? ` with ${productName}` : ''}${targetMarket ? ` in ${targetMarket}` : ''}.
${priorDataSummary}

Identify 8-12 significant risks across these categories:
- market: Market size, demand, timing risks
- competitive: Competition, substitutes, pricing pressure
- operational: Execution, team, scalability risks
- financial: Cash flow, funding, unit economics risks
- regulatory: Compliance, legal, policy risks
- technical: Technology, security, integration risks

For each risk:
- Assign a unique ID (risk_001, risk_002, etc.)
- Categorize appropriately
- Give a short name
- Provide detailed description
- Score likelihood (1=rare, 2=unlikely, 3=possible, 4=likely, 5=almost certain)
- Score impact (1=negligible, 2=minor, 3=moderate, 4=major, 5=catastrophic)

Respond with JSON:
{
  "risks": [
    {
      "id": "risk_001",
      "category": "market" | "competitive" | "operational" | "financial" | "regulatory" | "technical",
      "name": "<short risk name>",
      "description": "<detailed description>",
      "likelihood": <1-5>,
      "impact": <1-5>
    }
  ]
}`;

  return sendMessageForJSON<{
    risks: Array<{
      id: string;
      category: Risk['category'];
      name: string;
      description: string;
      likelihood: 1 | 2 | 3 | 4 | 5;
      impact: 1 | 2 | 3 | 4 | 5;
    }>;
  }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
}

function generateRiskMatrix(risks: Array<Risk & { risk_score: number }>): RiskMatrixCell[][] {
  // Create 5x5 matrix
  const matrix: RiskMatrixCell[][] = [];

  for (let impact = 5; impact >= 1; impact--) {
    const row: RiskMatrixCell[] = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const score = likelihood * impact;
      const matchingRisks = risks.filter(
        (r) => r.likelihood === likelihood && r.impact === impact
      );

      row.push({
        likelihood,
        impact,
        risk_ids: matchingRisks.map((r) => r.id),
        color: getRiskColor(score),
      });
    }
    matrix.push(row);
  }

  return matrix;
}

function getRiskColor(score: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (score <= 3) return 'green';
  if (score <= 6) return 'yellow';
  if (score <= 12) return 'orange';
  return 'red';
}

async function generateMitigations(
  risks: Array<{
    id: string;
    category: string;
    name: string;
    description: string;
    likelihood: number;
    impact: number;
    risk_score: number;
  }>
): Promise<{
  data: { mitigations: Mitigation[] };
  cost: number;
}> {
  // Focus on high-priority risks (score >= 8)
  const priorityRisks = risks.filter((r) => r.risk_score >= 6);

  const prompt = `Generate mitigation strategies for these risks:

${priorityRisks.map((r) => `- ${r.id}: ${r.name} (Score: ${r.risk_score})\n  ${r.description}`).join('\n\n')}

For each risk, provide 1-2 mitigation strategies with:
- risk_id: Which risk this mitigates
- strategy: Detailed mitigation approach
- cost_estimate: Rough cost in USD (or null if minimal)
- effectiveness: "high", "medium", or "low"
- timeline: How long to implement (e.g., "2-4 weeks", "3-6 months")

Respond with JSON:
{
  "mitigations": [
    {
      "risk_id": "<risk_id>",
      "strategy": "<detailed mitigation strategy>",
      "cost_estimate": <USD or null>,
      "effectiveness": "high" | "medium" | "low",
      "timeline": "<implementation timeline>"
    }
  ]
}`;

  return sendMessageForJSON<{ mitigations: Mitigation[] }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
}

function calculateOverallRiskScore(risks: Risk[]): number {
  if (risks.length === 0) return 0;

  // Weight higher risks more heavily
  const weights = risks.map((r) => r.risk_score);
  const maxWeight = Math.max(...weights);

  let weightedSum = 0;
  let totalWeight = 0;

  for (const risk of risks) {
    const weight = risk.risk_score / maxWeight;
    weightedSum += risk.risk_score * weight;
    totalWeight += weight;
  }

  // Normalize to 0-100 scale
  const avgWeightedScore = weightedSum / totalWeight;
  return Math.round((avgWeightedScore / 25) * 100); // 25 is max possible score (5*5)
}
