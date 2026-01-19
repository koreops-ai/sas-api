/**
 * Supabase client configuration
 * SAS Market Validation Platform
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Analysis,
  AnalysisModule,
  HITLCheckpoint,
  User,
  Evidence,
  CreditTransaction,
  Preset,
  ModuleStatus,
  AnalysisStatus,
  HITLAction,
} from '../types/database.js';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Table name mapping (override with env vars if Supabase schema differs)
export const TABLES = {
  analyses: process.env.SUPABASE_TABLE_ANALYSES || 'analyses',
  modules: process.env.SUPABASE_TABLE_MODULES || 'module_results',
  hitl: process.env.SUPABASE_TABLE_HITL || 'checkpoints',
  users: process.env.SUPABASE_TABLE_USERS || 'profiles',
  presets: process.env.SUPABASE_TABLE_PRESETS || 'presets',
  credits: process.env.SUPABASE_TABLE_CREDITS || 'credit_transactions',
  evidence: process.env.SUPABASE_TABLE_EVIDENCE || 'evidence',
};

// Create Supabase client with service role key for server-side operations
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ============ ANALYSIS OPERATIONS ============

export async function getAnalysis(id: string): Promise<Analysis | null> {
  const { data, error } = await supabase
    .from(TABLES.analyses)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching analysis:', error);
    return null;
  }
  return data;
}

export async function listAnalyses(
  userId: string,
  limit = 10,
  offset = 0,
  status?: AnalysisStatus
): Promise<{ data: Analysis[]; total: number }> {
  let query = supabase
    .from(TABLES.analyses)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing analyses:', error);
    return { data: [], total: 0 };
  }

  return { data: data || [], total: count || 0 };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

export async function createAnalysis(
  analysis: Omit<
    Analysis,
    'id' | 'created_at' | 'updated_at' | 'completed_at' | 'started_at'
  >
): Promise<Analysis | null> {
  const payload = stripUndefined({ ...analysis });

  console.log('Creating analysis with payload:', JSON.stringify(payload, null, 2));

  const { data, error } = await supabase
    .from(TABLES.analyses)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error creating analysis:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Payload was:', JSON.stringify(payload, null, 2));
    return null;
  }
  return data;
}

export async function updateAnalysis(
  id: string,
  updates: Partial<Analysis>
): Promise<Analysis | null> {
  const { data, error } = await supabase
    .from(TABLES.analyses)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating analysis:', error);
    return null;
  }
  return data;
}

export async function updateAnalysisStatus(
  id: string,
  status: AnalysisStatus,
  progress?: number
): Promise<boolean> {
  const updates: Partial<Analysis> = { status };
  if (progress !== undefined) updates.progress = progress;
  if (status === 'completed') updates.completed_at = new Date().toISOString();

  const result = await updateAnalysis(id, updates);
  return result !== null;
}

// ============ MODULE OPERATIONS ============

export async function getAnalysisModules(analysisId: string): Promise<AnalysisModule[]> {
  const { data, error } = await supabase
    .from(TABLES.modules)
    .select('*')
    .eq('analysis_id', analysisId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching modules:', error);
    return [];
  }
  return data || [];
}

export async function createModule(
  module: Omit<AnalysisModule, 'id'>
): Promise<AnalysisModule | null> {
  const { data, error } = await supabase
    .from(TABLES.modules)
    .insert(module)
    .select()
    .single();

  if (error) {
    console.error('Error creating module:', error);
    return null;
  }
  return data;
}

export async function updateModule(
  id: string,
  updates: Partial<AnalysisModule>
): Promise<AnalysisModule | null> {
  const { data, error } = await supabase
    .from(TABLES.modules)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating module:', error);
    return null;
  }
  return data;
}

export async function updateModuleStatus(
  id: string,
  status: ModuleStatus,
  progress?: number,
  data?: Record<string, unknown>,
  error?: string
): Promise<boolean> {
  const updates: Partial<AnalysisModule> = { status };
  if (progress !== undefined) updates.progress = progress;
  if (data) updates.data = data;
  if (error) updates.error = error;
  if (status === 'running') updates.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }

  const result = await updateModule(id, updates);
  return result !== null;
}

// ============ HITL OPERATIONS ============

export async function createHITLCheckpoint(
  checkpoint: Omit<HITLCheckpoint, 'id' | 'created_at' | 'resolved_at'>
): Promise<HITLCheckpoint | null> {
  const { data, error } = await supabase
    .from(TABLES.hitl)
    .insert(checkpoint)
    .select()
    .single();

  if (error) {
    console.error('Error creating HITL checkpoint:', error);
    return null;
  }
  return data;
}

export async function getHITLCheckpoint(id: string): Promise<HITLCheckpoint | null> {
  const { data, error } = await supabase
    .from(TABLES.hitl)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching HITL checkpoint:', error);
    return null;
  }
  return data;
}

export async function getPendingHITLCheckpoints(userId: string): Promise<HITLCheckpoint[]> {
  // Use a simpler approach: fetch checkpoints then filter by analysis ownership
  const { data: checkpoints, error: checkpointError } = await supabase
    .from(TABLES.hitl)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (checkpointError || !checkpoints) {
    console.error('Error fetching pending checkpoints:', checkpointError);
    return [];
  }

  // Filter by user's analyses
  const analysisIds = [...new Set(checkpoints.map((c: HITLCheckpoint) => c.analysis_id))];
  if (analysisIds.length === 0) return [];

  const { data: analyses, error: analysisError } = await supabase
    .from(TABLES.analyses)
    .select('id')
    .eq('user_id', userId)
    .in('id', analysisIds);

  if (analysisError) {
    console.error('Error fetching analyses for checkpoints:', analysisError);
    return [];
  }

  const userAnalysisIds = new Set((analyses || []).map((a: { id: string }) => a.id));
  return checkpoints.filter((c: HITLCheckpoint) => userAnalysisIds.has(c.analysis_id));
}

export async function resolveHITLCheckpoint(
  id: string,
  reviewerId: string,
  action: HITLAction,
  comment?: string,
  adjustments?: Record<string, unknown>
): Promise<HITLCheckpoint | null> {
  const status = action === 'reject' ? 'rejected' :
                 action === 'request_revision' ? 'revision_requested' : 'approved';

  const { data, error } = await supabase
    .from(TABLES.hitl)
    .update({
      status,
      reviewer_id: reviewerId,
      reviewer_comment: comment,
      action,
      adjustments,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error resolving HITL checkpoint:', error);
    return null;
  }
  return data;
}

// ============ USER & CREDITS ============

export async function getUser(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from(TABLES.users)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data;
}

export async function updateUserCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  const { error } = await supabase.rpc('update_user_credits', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error('Error updating credits:', error);
    return false;
  }
  return true;
}

export async function recordCreditTransaction(
  transaction: Omit<CreditTransaction, 'id' | 'created_at'>
): Promise<CreditTransaction | null> {
  const { data, error } = await supabase
    .from(TABLES.credits)
    .insert(transaction)
    .select()
    .single();

  if (error) {
    console.error('Error recording credit transaction:', error);
    return null;
  }
  return data;
}

export async function deductCredits(
  userId: string,
  amount: number,
  analysisId: string,
  description: string
): Promise<boolean> {
  // Use a transaction to ensure atomicity
  const { error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_analysis_id: analysisId,
    p_description: description,
  });

  if (error) {
    console.error('Error deducting credits:', error);
    return false;
  }
  return true;
}

// ============ PRESETS ============

export async function getPresets(userId: string, teamId?: string): Promise<Preset[]> {
  let query = supabase
    .from(TABLES.presets)
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${userId}${teamId ? `,team_id.eq.${teamId}` : ''}`);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching presets:', error);
    return [];
  }
  return data || [];
}

export async function getPreset(id: string): Promise<Preset | null> {
  const { data, error } = await supabase
    .from(TABLES.presets)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching preset:', error);
    return null;
  }
  return data;
}

export async function createPreset(
  preset: Omit<Preset, 'id' | 'created_at'>
): Promise<Preset | null> {
  const { data, error } = await supabase
    .from(TABLES.presets)
    .insert(preset)
    .select()
    .single();

  if (error) {
    console.error('Error creating preset:', error);
    return null;
  }
  return data;
}

export async function updatePreset(
  id: string,
  updates: Partial<Omit<Preset, 'id' | 'created_at' | 'is_system'>>
): Promise<Preset | null> {
  // Don't allow updating system presets
  const existing = await getPreset(id);
  if (existing?.is_system) {
    console.error('Cannot update system preset');
    return null;
  }

  const { data, error } = await supabase
    .from(TABLES.presets)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating preset:', error);
    return null;
  }
  return data;
}

export async function deletePreset(id: string, userId: string): Promise<boolean> {
  // Don't allow deleting system presets
  const existing = await getPreset(id);
  if (existing?.is_system) {
    console.error('Cannot delete system preset');
    return false;
  }

  // Verify ownership
  if (existing?.user_id && existing.user_id !== userId) {
    console.error('Cannot delete preset owned by another user');
    return false;
  }

  const { error } = await supabase
    .from(TABLES.presets)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting preset:', error);
    return false;
  }
  return true;
}

// ============ EVIDENCE ============

export async function storeEvidence(
  evidence: Omit<Evidence, 'id' | 'created_at'>
): Promise<Evidence | null> {
  const { data, error } = await supabase
    .from(TABLES.evidence)
    .insert(evidence)
    .select()
    .single();

  if (error) {
    console.error('Error storing evidence:', error);
    return null;
  }
  return data;
}

export async function getModuleEvidence(moduleId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from(TABLES.evidence)
    .select('*')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching evidence:', error);
    return [];
  }
  return data || [];
}

export async function getLatestEvidenceBySource(
  analysisId: string,
  sourceUrl: string
): Promise<Evidence | null> {
  const { data, error } = await supabase
    .from(TABLES.evidence)
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('source_url', sourceUrl)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching evidence by source:', error);
    return null;
  }
  return data ?? null;
}

// ============ STORAGE (Screenshots, etc.) ============

export async function uploadEvidence(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType });

  if (error) {
    console.error('Error uploading evidence:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
