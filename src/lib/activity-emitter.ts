/**
 * Activity Emitter for Real-time Updates
 * SAS Market Validation Platform
 *
 * Emits activities to Supabase for live streaming to frontend
 */

import { supabase } from './supabase.js';
import type { ModuleType } from '../types/database.js';

export type ActivityType =
  | 'search'
  | 'result'
  | 'agent_start'
  | 'agent_complete'
  | 'llm_call'
  | 'progress'
  | 'error'
  | 'hitl_pending';

export interface Activity {
  id: string;
  analysis_id: string;
  module_type: ModuleType | null;
  agent_name: string | null;
  activity_type: ActivityType;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const TABLE = 'activity_logs';

/**
 * Emit an activity to the real-time stream
 */
export async function emitActivity(
  analysisId: string,
  activity: {
    type: ActivityType;
    message: string;
    moduleType?: ModuleType;
    agentName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Activity | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      analysis_id: analysisId,
      module_type: activity.moduleType || null,
      agent_name: activity.agentName || null,
      activity_type: activity.type,
      message: activity.message,
      metadata: activity.metadata || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error emitting activity:', error);
    return null;
  }

  return data;
}

/**
 * Helper: Emit search started
 */
export async function emitSearch(
  analysisId: string,
  moduleType: ModuleType,
  query: string
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'search',
    moduleType,
    message: `Searching "${query}"...`,
    metadata: { query },
  });
}

/**
 * Helper: Emit search results received
 */
export async function emitSearchResult(
  analysisId: string,
  moduleType: ModuleType,
  resultCount: number,
  source: string
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'result',
    moduleType,
    message: `Found ${resultCount} results from ${source}`,
    metadata: { resultCount, source },
  });
}

/**
 * Helper: Emit agent started
 */
export async function emitAgentStart(
  analysisId: string,
  moduleType: ModuleType,
  agentName: string
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'agent_start',
    moduleType,
    agentName,
    message: `Running ${agentName}...`,
  });
}

/**
 * Helper: Emit agent completed
 */
export async function emitAgentComplete(
  analysisId: string,
  moduleType: ModuleType,
  agentName: string,
  summary?: string
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'agent_complete',
    moduleType,
    agentName,
    message: summary || `${agentName} completed`,
  });
}

/**
 * Helper: Emit LLM call
 */
export async function emitLLMCall(
  analysisId: string,
  moduleType: ModuleType,
  model: string,
  purpose: string
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'llm_call',
    moduleType,
    message: `Processing with ${model}: ${purpose}`,
    metadata: { model, purpose },
  });
}

/**
 * Helper: Emit progress update
 */
export async function emitProgress(
  analysisId: string,
  message: string,
  moduleType?: ModuleType
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'progress',
    moduleType,
    message,
  });
}

/**
 * Helper: Emit error
 */
export async function emitError(
  analysisId: string,
  message: string,
  moduleType?: ModuleType,
  errorDetails?: unknown
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'error',
    moduleType,
    message,
    metadata: errorDetails ? { error: String(errorDetails) } : undefined,
  });
}

/**
 * Helper: Emit HITL pending
 */
export async function emitHITLPending(
  analysisId: string,
  moduleType: ModuleType,
  checkpointId: string
): Promise<void> {
  await emitActivity(analysisId, {
    type: 'hitl_pending',
    moduleType,
    message: `Ready for human review`,
    metadata: { checkpointId },
  });
}

/**
 * Get recent activities for an analysis
 */
export async function getActivities(
  analysisId: string,
  limit = 100
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('analysis_id', analysisId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching activities:', error);
    return [];
  }

  return data || [];
}

/**
 * Get activities for a specific module
 */
export async function getModuleActivities(
  analysisId: string,
  moduleType: ModuleType
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('module_type', moduleType)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching module activities:', error);
    return [];
  }

  return data || [];
}
