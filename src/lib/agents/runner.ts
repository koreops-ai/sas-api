import type { ModuleType } from '../../types/database.js';
import type { AgentContext, AgentResult } from './types.js';
import { getAgentsForModule } from './registry.js';
import { getMemorySummary, storeMemorySummary } from './memory.js';

export async function runChildAgents(
  moduleType: ModuleType,
  context: AgentContext
): Promise<AgentResult[]> {
  const agents = getAgentsForModule(moduleType);
  if (!agents.length) return [];

  const results: AgentResult[] = [];
  const analysisMemory = await getMemorySummary(context.analysis_id, 'analysis');
  for (const agent of agents) {
    try {
      const agentMemory = await getMemorySummary(context.analysis_id, 'agent', agent.type);
      const result = await agent.run({
        ...context,
        analysis_memory: analysisMemory,
        agent_memory: agentMemory,
      });
      results.push(result);

      await storeMemorySummary({
        analysisId: context.analysis_id,
        moduleId: context.module_id,
        scope: 'agent',
        agent: agent.type,
        summary: result.summary,
      });
      await storeMemorySummary({
        analysisId: context.analysis_id,
        moduleId: context.module_id,
        scope: 'analysis',
        summary: result.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent failed';
      results.push({
        agent: agent.type,
        summary: message,
        data: { error: message },
        sources: [],
        evidence_paths: [],
        cost: 0,
        duration_ms: 0,
        provider: agent.provider,
        model: agent.model,
      });
    }
  }

  return results;
}
