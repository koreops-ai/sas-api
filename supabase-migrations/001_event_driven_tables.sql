-- ============================================================================
-- Event-Driven Architecture Tables
-- Run this SQL in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================================

-- 1. Module Queue Table
-- Stores queued modules for async processing
CREATE TABLE IF NOT EXISTS module_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  worker_id TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_module_queue_status ON module_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_module_queue_analysis ON module_queue(analysis_id);

-- 2. Activity Logs Table
-- Real-time activity streaming for live UI updates
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  module_type TEXT,
  agent_name TEXT,
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching activities by analysis
CREATE INDEX IF NOT EXISTS idx_activity_logs_analysis ON activity_logs(analysis_id, created_at DESC);

-- 3. Enable Supabase Realtime for activity_logs
-- This allows the frontend to subscribe to live updates
-- Note: Skip if already added (will error with 42710 if already member)
-- ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;

-- 4. Row Level Security (RLS)
ALTER TABLE module_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view queue items for their own analyses
CREATE POLICY "Users can view own analysis queue" ON module_queue
  FOR SELECT USING (
    analysis_id IN (SELECT id FROM analyses WHERE user_id = auth.uid())
  );

-- Users can view activity logs for their own analyses
CREATE POLICY "Users can view own analysis activities" ON activity_logs
  FOR SELECT USING (
    analysis_id IN (SELECT id FROM analyses WHERE user_id = auth.uid())
  );

-- Service role (backend) has full access to queue
CREATE POLICY "Service role full access queue" ON module_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Service role (backend) has full access to activity logs
CREATE POLICY "Service role full access activities" ON activity_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Verification: Run these to confirm tables were created
-- ============================================================================
-- SELECT * FROM module_queue LIMIT 1;
-- SELECT * FROM activity_logs LIMIT 1;
