import type { AgentType } from './types.js';
import { getLatestEvidenceBySource, storeEvidence } from '../supabase.js';

export type MemoryScope = 'analysis' | 'agent';

function getMemorySource(scope: MemoryScope, agent?: AgentType): string {
  if (scope === 'analysis') return 'memory:analysis';
  return `memory:agent:${agent ?? 'unknown'}`;
}

export async function getMemorySummary(
  analysisId: string,
  scope: MemoryScope,
  agent?: AgentType
): Promise<string | null> {
  const sourceUrl = getMemorySource(scope, agent);
  const evidence = await getLatestEvidenceBySource(analysisId, sourceUrl);
  if (!evidence) return null;
  const summary = evidence.metadata?.summary;
  return typeof summary === 'string' ? summary : null;
}

export async function storeMemorySummary(options: {
  analysisId: string;
  moduleId: string;
  scope: MemoryScope;
  summary: string;
  agent?: AgentType;
}): Promise<string | null> {
  const sourceUrl = getMemorySource(options.scope, options.agent);
  const storagePath = `analyses/${options.analysisId}/memory/${sourceUrl.replace(/[:/]/g, '-')}.json`;

  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: sourceUrl,
    source_type: 'api_response',
    content_type: 'application/json',
    storage_path: storagePath,
    metadata: {
      scope: options.scope,
      agent: options.agent,
      summary: options.summary,
      timestamp: new Date().toISOString(),
    },
  });

  return evidence ? storagePath : null;
}
