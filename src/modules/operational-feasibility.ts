/**
 * Operational Feasibility Module
 * Resource requirements, timeline, dependencies, and feasibility scoring
 *
 * Estimated time: 5-8 minutes
 * Uses data from all prior modules to assess operational feasibility
 */

import type {
  ModuleExecutionContext,
  ModuleResult,
  OperationalFeasibilityData,
  ResourceRequirements,
  ProjectTimeline,
  Dependency,
  RoleRequirement,
  ProjectPhase,
  Milestone,
} from '../types/modules.js';
import { sendMessageForJSON } from '../lib/anthropic.js';
import { storeEvidence } from '../lib/supabase.js';

const SYSTEM_PROMPT = `You are an operational feasibility expert specializing in startup execution planning.
You assess resource requirements, timelines, dependencies, and provide go/no-go recommendations.
Be realistic and practical - focus on actionable insights and potential blockers.
Consider team, technology, infrastructure, and operational dependencies.`;

export async function executeOperationalFeasibility(
  context: ModuleExecutionContext
): Promise<ModuleResult<OperationalFeasibilityData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];

  try {
    // Step 1: Analyze resource requirements
    const resourceResult = await analyzeResourceRequirements(
      context.company_name,
      context.product_name,
      context.description,
      context.target_market,
      context.prior_module_data || {}
    );
    totalCost += resourceResult.cost;

    // Step 2: Generate project timeline
    const timelineResult = await generateProjectTimeline(
      context.product_name,
      context.target_market,
      resourceResult.data,
      context.prior_module_data || {}
    );
    totalCost += timelineResult.cost;

    // Step 3: Identify dependencies
    const dependenciesResult = await identifyDependencies(
      context.company_name,
      context.product_name,
      resourceResult.data,
      context.prior_module_data || {}
    );
    totalCost += dependenciesResult.cost;

    // Step 4: Calculate feasibility score and recommendation
    const feasibilityResult = await assessFeasibility(
      resourceResult.data,
      timelineResult.data,
      dependenciesResult.data,
      context.prior_module_data || {}
    );
    totalCost += feasibilityResult.cost;

    const data: OperationalFeasibilityData = {
      resource_requirements: resourceResult.data,
      timeline: timelineResult.data,
      dependencies: dependenciesResult.data.dependencies,
      feasibility_score: feasibilityResult.data.feasibility_score,
      go_no_go_recommendation: feasibilityResult.data.go_no_go_recommendation,
      conditions: feasibilityResult.data.conditions,
    };

    // Store evidence
    await storeEvidence({
      analysis_id: context.analysis_id,
      module_id: context.module_id,
      source_url: 'operational-feasibility',
      source_type: 'api_response',
      content_type: 'application/json',
      storage_path: `analyses/${context.analysis_id}/operational-feasibility.json`,
      metadata: {
        timestamp: new Date().toISOString(),
        feasibility_score: data.feasibility_score,
        recommendation: data.go_no_go_recommendation,
        team_size: data.resource_requirements.team_size,
        total_months: data.timeline.total_months,
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
      error: error instanceof Error ? error.message : 'Unknown error in operational feasibility',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  }
}

async function analyzeResourceRequirements(
  companyName: string,
  productName: string | null,
  description: string | null,
  targetMarket: string | null,
  priorData: Record<string, unknown>
): Promise<{
  data: ResourceRequirements;
  cost: number;
}> {
  const priorDataSummary = Object.keys(priorData).length > 0
    ? `\n\nPrior Analysis Data Available:\n${JSON.stringify(priorData, null, 2).slice(0, 3000)}...`
    : '';

  const prompt = `Analyze operational resource requirements for ${companyName}${productName ? ` developing ${productName}` : ''}${targetMarket ? ` for the ${targetMarket} market` : ''}.
${description ? `\nProduct Description: ${description}` : ''}
${priorDataSummary}

Provide detailed resource requirements including:

1. Team Size: Total number of people needed
2. Key Roles: List each critical role with:
   - Role name (e.g., "Senior Full-Stack Engineer", "Product Manager")
   - Count needed
   - Required skills/experience
   - Estimated annual salary range in USD
3. Technology Stack: Specific technologies, frameworks, tools needed
4. Infrastructure Needs: Cloud services, hardware, third-party services
5. Estimated Monthly Burn: Total monthly operational costs in USD

Be realistic based on:
- Product complexity (from prior analysis)
- Market requirements (from prior analysis)
- Typical startup team structures
- Industry standards for similar products

Respond with JSON:
{
  "team_size": <number>,
  "key_roles": [
    {
      "role": "<role name>",
      "count": <number>,
      "skills": ["<skill1>", "<skill2>", ...],
      "estimated_salary": <USD per year>
    }
  ],
  "technology_stack": ["<tech1>", "<tech2>", ...],
  "infrastructure_needs": ["<infra1>", "<infra2>", ...],
  "estimated_monthly_burn": <USD>
}`;

  return sendMessageForJSON<ResourceRequirements>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
}

async function generateProjectTimeline(
  productName: string | null,
  targetMarket: string | null,
  resourceRequirements: ResourceRequirements,
  priorData: Record<string, unknown>
): Promise<{
  data: ProjectTimeline;
  cost: number;
}> {
  const priorDataSummary = Object.keys(priorData).length > 0
    ? `\n\nPrior Analysis Data:\n${JSON.stringify(priorData, null, 2).slice(0, 2000)}...`
    : '';

  const prompt = `Create a realistic project timeline for launching ${productName || 'the product'}${targetMarket ? ` in ${targetMarket}` : ''}.

Resource Requirements:
${JSON.stringify(resourceRequirements, null, 2)}
${priorDataSummary}

Create a timeline with:

1. Total Months: Realistic time to launch (MVP + initial market entry)
2. Phases: Break down into 3-5 major phases (e.g., "Planning & Design", "Development - MVP", "Testing & Iteration", "Launch Preparation", "Market Entry")
   Each phase should have:
   - Name
   - Duration in months
   - Key deliverables
   - Dependencies on other phases
3. Milestones: 5-8 key milestones with:
   - Name
   - Target date (relative, e.g., "Month 3")
   - Success criteria

Consider:
- Team ramp-up time
- Development complexity
- Testing requirements
- Market readiness
- Competitive landscape (from prior analysis if available)

Respond with JSON:
{
  "total_months": <number>,
  "phases": [
    {
      "name": "<phase name>",
      "duration_months": <number>,
      "deliverables": ["<deliverable1>", ...],
      "dependencies": ["<phase name or 'none'>"]
    }
  ],
  "milestones": [
    {
      "name": "<milestone name>",
      "target_date": "<e.g., 'Month 3'>",
      "criteria": ["<criterion1>", ...]
    }
  ]
}`;

  return sendMessageForJSON<ProjectTimeline>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
}

async function identifyDependencies(
  companyName: string,
  productName: string | null,
  resourceRequirements: ResourceRequirements,
  priorData: Record<string, unknown>
): Promise<{
  data: { dependencies: Dependency[] };
  cost: number;
}> {
  const priorDataSummary = Object.keys(priorData).length > 0
    ? `\n\nPrior Analysis Data:\n${JSON.stringify(priorData, null, 2).slice(0, 2000)}...`
    : '';

  const prompt = `Identify critical dependencies for ${companyName}${productName ? ` launching ${productName}` : ''}.

Resource Requirements:
${JSON.stringify(resourceRequirements, null, 2)}
${priorDataSummary}

Identify 5-10 critical dependencies across these types:
- internal: Team, internal processes, resources
- external: Third-party services, partnerships, vendors
- technical: Infrastructure, APIs, platforms
- regulatory: Compliance, licenses, approvals

For each dependency:
- Name (descriptive)
- Type (internal/external/technical/regulatory)
- Status (resolved/pending/blocked)
- Impact (critical/high/medium/low)
- Resolution plan (how to resolve if not resolved)

Consider:
- Market requirements (regulatory, compliance)
- Technical dependencies (APIs, platforms)
- Team dependencies (key hires)
- Partnership requirements
- Infrastructure dependencies

Respond with JSON:
{
  "dependencies": [
    {
      "name": "<dependency name>",
      "type": "internal" | "external" | "technical" | "regulatory",
      "status": "resolved" | "pending" | "blocked",
      "impact": "critical" | "high" | "medium" | "low",
      "resolution_plan": "<detailed plan>"
    }
  ]
}`;

  return sendMessageForJSON<{ dependencies: Dependency[] }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
}

async function assessFeasibility(
  resourceRequirements: ResourceRequirements,
  timeline: ProjectTimeline,
  dependencies: { dependencies: Dependency[] },
  priorData: Record<string, unknown>
): Promise<{
  data: {
    feasibility_score: number;
    go_no_go_recommendation: 'go' | 'conditional_go' | 'no_go';
    conditions: string[];
  };
  cost: number;
}> {
  const priorDataSummary = Object.keys(priorData).length > 0
    ? `\n\nPrior Analysis Context:\n${JSON.stringify(priorData, null, 2).slice(0, 2000)}...`
    : '';

  const prompt = `Assess operational feasibility based on:

Resource Requirements:
${JSON.stringify(resourceRequirements, null, 2)}

Project Timeline:
${JSON.stringify(timeline, null, 2)}

Dependencies:
${JSON.stringify(dependencies, null, 2)}
${priorDataSummary}

Provide a feasibility assessment:

1. Feasibility Score: 0-100 (higher = more feasible)
   Consider:
   - Resource availability (team, budget)
   - Timeline realism
   - Dependency risks
   - Market readiness (from prior analysis)
   - Competitive landscape (from prior analysis)

2. Go/No-Go Recommendation:
   - "go": Feasible, proceed with confidence
   - "conditional_go": Feasible but with important conditions
   - "no_go": Not feasible as currently planned

3. Conditions: List 3-7 specific conditions or requirements that must be met
   (e.g., "Secure $500K seed funding", "Hire senior engineer within 2 months", "Obtain regulatory approval")

Scoring Guidelines:
- 80-100: Highly feasible (go)
- 60-79: Feasible with conditions (conditional_go)
- 40-59: Challenging but possible (conditional_go)
- 0-39: Not feasible (no_go)

Respond with JSON:
{
  "feasibility_score": <0-100>,
  "go_no_go_recommendation": "go" | "conditional_go" | "no_go",
  "conditions": ["<condition1>", "<condition2>", ...]
}`;

  return sendMessageForJSON<{
    feasibility_score: number;
    go_no_go_recommendation: 'go' | 'conditional_go' | 'no_go';
    conditions: string[];
  }>(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 4096,
  });
}
