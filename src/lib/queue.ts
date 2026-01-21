/**
 * Module Queue Management
 * SAS Market Validation Platform
 *
 * Handles async job queue for module execution
 */

import { supabase } from './supabase.js';
import type { ModuleType } from '../types/database.js';
import { nanoid } from 'nanoid';

export interface QueuedJob {
  id: string;
  analysis_id: string;
  module_type: ModuleType;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  worker_id: string | null;
  locked_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const TABLE = 'module_queue';

/**
 * Queue all modules for an analysis
 */
export async function queueModulesForAnalysis(
  analysisId: string,
  modules: ModuleType[]
): Promise<QueuedJob[]> {
  const jobs = modules.map((moduleType, index) => ({
    analysis_id: analysisId,
    module_type: moduleType,
    status: 'queued' as const,
    priority: getPriority(moduleType),
    attempts: 0,
    max_attempts: 3,
  }));

  const { data, error } = await supabase
    .from(TABLE)
    .insert(jobs)
    .select();

  if (error) {
    console.error('Error queuing modules:', error);
    throw new Error(`Failed to queue modules: ${error.message}`);
  }

  return data || [];
}

/**
 * Get priority for a module (higher = processed first)
 * Independent modules get higher priority than dependent ones
 */
function getPriority(moduleType: ModuleType): number {
  const priorities: Record<ModuleType, number> = {
    // Independent modules - high priority
    market_demand: 100,
    competitive_intelligence: 100,
    social_sentiment: 100,
    linkedin_contacts: 100,
    google_maps: 100,
    // Dependent modules - lower priority
    revenue_intelligence: 50,
    financial_modeling: 25,
    risk_assessment: 25,
    operational_feasibility: 10,
  };
  return priorities[moduleType] ?? 50;
}

/**
 * Claim the next available job for processing
 * Uses row-level locking to prevent race conditions
 */
export async function claimNextJob(workerId?: string): Promise<QueuedJob | null> {
  const workerTag = workerId || `worker-${nanoid(8)}`;
  const now = new Date().toISOString();

  // Lock timeout: 5 minutes (if a worker dies, job becomes available again)
  const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Find and claim a job atomically
  // Priority: queued jobs first, then stale locked jobs
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'processing',
      worker_id: workerTag,
      locked_at: now,
      started_at: now,
    })
    .or(`status.eq.queued,and(status.eq.processing,locked_at.lt.${lockTimeout})`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .select()
    .single();

  if (error) {
    // No job found is not an error
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error claiming job:', error);
    return null;
  }

  // Increment attempts
  if (data) {
    await supabase
      .from(TABLE)
      .update({ attempts: (data.attempts || 0) + 1 })
      .eq('id', data.id);
  }

  return data;
}

/**
 * Mark a job as completed
 */
export async function completeJob(jobId: string): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error completing job:', error);
    return false;
  }
  return true;
}

/**
 * Mark a job as failed
 */
export async function failJob(jobId: string, errorMessage: string): Promise<boolean> {
  const { data: job } = await supabase
    .from(TABLE)
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .single();

  const shouldRetry = job && job.attempts < job.max_attempts;

  const { error } = await supabase
    .from(TABLE)
    .update({
      status: shouldRetry ? 'queued' : 'failed',
      error_message: errorMessage,
      locked_at: null,
      worker_id: null,
      completed_at: shouldRetry ? null : new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error failing job:', error);
    return false;
  }
  return true;
}

/**
 * Get queue status for an analysis
 */
export async function getQueueStatus(analysisId: string): Promise<{
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('status')
    .eq('analysis_id', analysisId);

  if (error || !data) {
    return { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 };
  }

  return {
    total: data.length,
    queued: data.filter(j => j.status === 'queued').length,
    processing: data.filter(j => j.status === 'processing').length,
    completed: data.filter(j => j.status === 'completed').length,
    failed: data.filter(j => j.status === 'failed').length,
  };
}

/**
 * Check if all modules for an analysis are done
 */
export async function isAnalysisComplete(analysisId: string): Promise<{
  complete: boolean;
  hasFailures: boolean;
}> {
  const status = await getQueueStatus(analysisId);

  const allDone = status.queued === 0 && status.processing === 0;
  const hasFailures = status.failed > 0;

  return { complete: allDone, hasFailures };
}

/**
 * Get pending jobs for an analysis
 */
export async function getPendingJobs(analysisId: string): Promise<QueuedJob[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('analysis_id', analysisId)
    .in('status', ['queued', 'processing'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching pending jobs:', error);
    return [];
  }

  return data || [];
}

/**
 * Cancel all pending jobs for an analysis
 */
export async function cancelAnalysisJobs(analysisId: string): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'failed',
      error_message: 'Analysis cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('analysis_id', analysisId)
    .in('status', ['queued', 'processing']);

  if (error) {
    console.error('Error cancelling jobs:', error);
    return false;
  }
  return true;
}
