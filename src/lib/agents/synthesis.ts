import type { Analysis, ModuleType } from '../../types/database.js';
import type { AgentResult, GlobalSynthesisResult, ModuleSynthesisResult } from './types.js';
import { runJsonCompletion } from '../llm/structured.js';
import { SYNTHESIS_CONFIG } from './registry.js';

function buildModulePrompt(
  moduleType: ModuleType,
  moduleData: Record<string, unknown>,
  agentResults: AgentResult[]
): string {
  return `Module: ${moduleType}

Module Data:
${JSON.stringify(moduleData, null, 2)}

Child Agent Findings:
${agentResults
  .map(
    (agent) =>
      `- ${agent.agent} (${agent.provider}/${agent.model}): ${agent.summary}\n  Sources: ${agent.sources.join(', ') || 'None'}`
  )
  .join('\n')}
`;
}

export async function synthesizeModule(
  moduleType: ModuleType,
  moduleData: Record<string, unknown>,
  agentResults: AgentResult[]
): Promise<ModuleSynthesisResult> {
  const systemPrompt =
    'You are a senior research analyst. Produce a concise module summary with citations.';
  const userPrompt = `${buildModulePrompt(moduleType, moduleData, agentResults)}

Return JSON:
{
  "summary": "...",
  "highlights": ["..."],
  "risks": ["..."],
  "recommendations": ["..."],
  "citations": ["url", "..."]
}`;

  const result = await runJsonCompletion<Omit<ModuleSynthesisResult, 'cost'>>(
    SYNTHESIS_CONFIG.provider,
    SYNTHESIS_CONFIG.model,
    systemPrompt,
    userPrompt
  );

  return { ...result.data, cost: result.cost };
}

export async function synthesizeGlobal(
  analysis: Analysis,
  moduleSummaries: Array<{ module: ModuleType; synthesis: ModuleSynthesisResult }>
): Promise<GlobalSynthesisResult> {
  const systemPrompt =
    'You are a strategy lead. Create a go/no-go summary based on module summaries.';
  const userPrompt = `Analysis:
Company: ${analysis.company_name}
Product: ${analysis.product_name ?? 'N/A'}
Target Market: ${analysis.target_market ?? 'N/A'}

Module Summaries:
${moduleSummaries
  .map(
    (item) =>
      `- ${item.module}: ${item.synthesis.summary}\n  Key risks: ${item.synthesis.risks.join('; ')}\n  Citations: ${item.synthesis.citations.join(', ')}`
  )
  .join('\n')}

Return JSON:
{
  "executive_summary": "...",
  "go_no_go": "go|conditional_go|no_go",
  "key_reasons": ["..."],
  "risks": ["..."],
  "next_steps": ["..."],
  "citations": ["url", "..."]
}`;

  const result = await runJsonCompletion<Omit<GlobalSynthesisResult, 'cost'>>(
    SYNTHESIS_CONFIG.provider,
    SYNTHESIS_CONFIG.model,
    systemPrompt,
    userPrompt
  );

  return { ...result.data, cost: result.cost };
}
