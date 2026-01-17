/**
 * Anthropic Claude client for analysis modules
 * SAS Market Validation Platform
 */

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// Model configuration
export const MODELS = {
  // Use Sonnet for most analysis tasks (cost-effective, high quality)
  analysis: 'claude-sonnet-4-20250514',
  // Use Haiku for simple extraction tasks
  extraction: 'claude-3-5-haiku-20241022',
} as const;

// Token pricing (per 1M tokens) as of Jan 2025
export const PRICING = {
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
  },
} as const;

export interface MessageOptions {
  model?: keyof typeof PRICING;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface MessageResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/**
 * Send a message to Claude and get a response
 */
export async function sendMessage(
  prompt: string,
  options: MessageOptions = {}
): Promise<MessageResult> {
  const {
    model = MODELS.analysis,
    maxTokens = 4096,
    temperature = 0.3,
    system,
  } = options;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Calculate cost
  const pricing = PRICING[model as keyof typeof PRICING];
  const cost =
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000;

  return {
    content,
    inputTokens,
    outputTokens,
    cost,
  };
}

/**
 * Send a message with structured JSON output
 */
export async function sendMessageForJSON<T>(
  prompt: string,
  options: MessageOptions = {}
): Promise<{ data: T; cost: number }> {
  const result = await sendMessage(prompt, {
    ...options,
    system: `${options.system || ''}\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.`.trim(),
  });

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const data = JSON.parse(jsonStr) as T;
  return { data, cost: result.cost };
}

/**
 * Analyze scraped data and extract structured information
 */
export async function analyzeScrapedData<T>(
  scrapedContent: string,
  extractionPrompt: string
): Promise<{ data: T; cost: number }> {
  const prompt = `Given the following scraped content:

<scraped_content>
${scrapedContent}
</scraped_content>

${extractionPrompt}

Respond with valid JSON only.`;

  return sendMessageForJSON<T>(prompt, {
    model: MODELS.extraction,
    maxTokens: 8192,
  });
}

/**
 * Generate market analysis from collected data
 */
export async function generateMarketAnalysis(
  companyName: string,
  productName: string | null,
  targetMarket: string | null,
  collectedData: Record<string, unknown>
): Promise<{ analysis: string; cost: number }> {
  const prompt = `You are a market research analyst. Analyze the following data for ${companyName}${productName ? ` (${productName})` : ''}${targetMarket ? ` in the ${targetMarket} market` : ''}.

<collected_data>
${JSON.stringify(collectedData, null, 2)}
</collected_data>

Provide a comprehensive market analysis including:
1. Market size (TAM/SAM/SOM) with confidence levels
2. Key market trends and growth drivers
3. Competitive positioning
4. Risk factors
5. Recommendations

Be specific with numbers and cite the data sources from the collected data.`;

  const result = await sendMessage(prompt, {
    model: MODELS.analysis,
    maxTokens: 8192,
    system: 'You are an expert market research analyst. Provide detailed, data-driven analysis with specific numbers and actionable insights.',
  });

  return { analysis: result.content, cost: result.cost };
}

/**
 * Generate SWOT analysis for a competitor
 */
export async function generateSWOT(
  competitorData: Record<string, unknown>
): Promise<{ swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }; cost: number }> {
  const prompt = `Analyze the following competitor data and generate a SWOT analysis:

<competitor_data>
${JSON.stringify(competitorData, null, 2)}
</competitor_data>

Provide exactly 3-5 items for each category (Strengths, Weaknesses, Opportunities, Threats).
Each item should be specific and actionable, not generic.

Respond with JSON in this format:
{
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "opportunities": ["...", "..."],
  "threats": ["...", "..."]
}`;

  const result = await sendMessageForJSON<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }>(prompt, {
    model: MODELS.analysis,
    maxTokens: 2048,
  });

  return {
    swot: result.data,
    cost: result.cost,
  };
}

/**
 * Analyze sentiment from social media posts
 */
export async function analyzeSentiment(
  posts: Array<{ content: string; platform: string; url?: string }>
): Promise<{
  sentiment: { positive: number; neutral: number; negative: number; compound: number };
  themes: Array<{ theme: string; frequency: number; sentiment: string }>;
  cost: number;
}> {
  const prompt = `Analyze the sentiment of the following social media posts:

<posts>
${posts.map((p, i) => `[${i + 1}] (${p.platform}) ${p.content}`).join('\n\n')}
</posts>

Provide:
1. Overall sentiment scores (positive, neutral, negative as percentages that sum to 100)
2. Compound sentiment score (-1 to 1)
3. Key themes mentioned (with frequency count and overall sentiment)

Respond with JSON:
{
  "sentiment": {
    "positive": <0-100>,
    "neutral": <0-100>,
    "negative": <0-100>,
    "compound": <-1 to 1>
  },
  "themes": [
    {"theme": "...", "frequency": <count>, "sentiment": "positive|neutral|negative"},
    ...
  ]
}`;

  const result = await sendMessageForJSON<{
    sentiment: { positive: number; neutral: number; negative: number; compound: number };
    themes: Array<{ theme: string; frequency: number; sentiment: string }>;
  }>(prompt, {
    model: MODELS.analysis,
    maxTokens: 4096,
  });

  return { ...result.data, cost: result.cost };
}

/**
 * Generate financial model projections
 */
export async function generateFinancialModel(
  marketData: Record<string, unknown>,
  revenueData: Record<string, unknown>,
  assumptions: Record<string, unknown>
): Promise<{ model: Record<string, unknown>; cost: number }> {
  const prompt = `Generate a 5-year financial model based on the following data:

<market_data>
${JSON.stringify(marketData, null, 2)}
</market_data>

<revenue_data>
${JSON.stringify(revenueData, null, 2)}
</revenue_data>

<assumptions>
${JSON.stringify(assumptions, null, 2)}
</assumptions>

Include:
1. Unit economics (ARPU, CAC, LTV, payback period)
2. Revenue projections (5 years)
3. Cost structure (fixed/variable)
4. Break-even analysis
5. Exit valuation scenarios

Respond with JSON containing all calculations and assumptions used.`;

  const result = await sendMessageForJSON<Record<string, unknown>>(prompt, {
    model: MODELS.analysis,
    maxTokens: 8192,
  });

  return {
    model: result.data,
    cost: result.cost,
  };
}

/**
 * Generate risk assessment
 */
export async function generateRiskAssessment(
  analysisData: Record<string, unknown>
): Promise<{
  risks: Array<{
    id: string;
    category: string;
    name: string;
    description: string;
    likelihood: number;
    impact: number;
    mitigations: Array<{ strategy: string; effectiveness: string }>;
  }>;
  cost: number;
}> {
  const prompt = `Based on the following analysis data, identify and assess key risks:

<analysis_data>
${JSON.stringify(analysisData, null, 2)}
</analysis_data>

Identify 5-10 key risks across these categories:
- Market risks
- Competitive risks
- Operational risks
- Financial risks
- Regulatory risks
- Technical risks

For each risk, provide:
- Unique ID (risk_001, risk_002, etc.)
- Category
- Name (short title)
- Description (detailed explanation)
- Likelihood (1-5 scale)
- Impact (1-5 scale)
- Mitigation strategies with effectiveness rating

Respond with JSON.`;

  const result = await sendMessageForJSON<{
    risks: Array<{
      id: string;
      category: string;
      name: string;
      description: string;
      likelihood: number;
      impact: number;
      mitigations: Array<{ strategy: string; effectiveness: string }>;
    }>;
  }>(prompt, {
    model: MODELS.analysis,
    maxTokens: 8192,
  });

  return {
    risks: result.data.risks,
    cost: result.cost,
  };
}
