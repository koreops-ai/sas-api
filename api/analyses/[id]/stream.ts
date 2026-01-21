/**
 * Analysis Stream API - Server-Sent Events
 * GET /api/analyses/[id]/stream - Stream analysis execution events
 *
 * Provides real-time streaming of:
 * - Activity logs (search, result, progress, etc.)
 * - Module status updates
 * - Block generation (progressive rendering)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAnalysis, getActivityLogs, supabase } from '../../../src/lib/supabase.js';

// SSE Event types
interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Send an SSE event to the client
 */
function sendSSE(res: VercelResponse, event: SSEEvent): void {
  res.write(`event: ${event.event}\n`);
  res.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

/**
 * Send a heartbeat to keep connection alive
 */
function sendHeartbeat(res: VercelResponse): void {
  res.write(`: heartbeat\n\n`);
}

/**
 * Main handler - supports both SSE streaming and REST fallback
 *
 * SSE mode (default): GET /api/analyses/[id]/stream?userId=...
 * REST mode: GET /api/analyses/[id]/stream?userId=...&mode=rest (returns activities as JSON)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get user ID from header or query param (EventSource doesn't support headers)
  const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const analysisId = req.query.id as string;
  if (!analysisId) {
    res.status(400).json({ error: 'Analysis ID is required' });
    return;
  }

  // Verify analysis exists and user has access
  const analysis = await getAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  if (analysis.user_id !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // REST mode fallback - return activities as JSON (replaces /api/analyses/[id]/activities)
  const mode = req.query.mode as string;
  if (mode === 'rest') {
    const activities = await getActivityLogs(analysisId);
    res.status(200).json(activities);
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  sendSSE(res, {
    event: 'connected',
    data: {
      analysisId,
      status: analysis.status,
      progress: analysis.progress,
    },
  });

  // Track last activity timestamp for polling
  let lastActivityTime = new Date(0).toISOString();
  let lastModuleStatus: Record<string, string> = {};

  // Send initial activities
  const initialActivities = await getActivityLogs(analysisId);
  if (initialActivities.length > 0) {
    sendSSE(res, {
      event: 'activities_batch',
      data: initialActivities,
    });
    lastActivityTime = initialActivities[initialActivities.length - 1].created_at;
  }

  // Get initial module statuses
  const { data: modules } = await supabase
    .from('analysis_modules')
    .select('module_type, status, output_data')
    .eq('analysis_id', analysisId);

  if (modules) {
    for (const mod of modules) {
      lastModuleStatus[mod.module_type] = mod.status;
      sendSSE(res, {
        event: 'module_status',
        data: {
          module: mod.module_type,
          status: mod.status,
          hasOutput: !!mod.output_data,
        },
      });
    }
  }

  // Polling interval for updates (check every 500ms for near-realtime)
  const pollInterval = 500;
  let isComplete = analysis.status === 'completed' || analysis.status === 'failed';

  // Heartbeat interval (every 15 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      sendHeartbeat(res);
    } catch {
      // Connection closed
      clearInterval(heartbeatInterval);
    }
  }, 15000);

  // Main polling loop
  const pollForUpdates = async (): Promise<void> => {
    try {
      // Check if client disconnected
      if (res.writableEnded) {
        clearInterval(heartbeatInterval);
        return;
      }

      // Fetch new activities
      const { data: newActivities } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('analysis_id', analysisId)
        .gt('created_at', lastActivityTime)
        .order('created_at', { ascending: true });

      if (newActivities && newActivities.length > 0) {
        for (const activity of newActivities) {
          sendSSE(res, {
            event: 'activity',
            data: activity,
          });
        }
        lastActivityTime = newActivities[newActivities.length - 1].created_at;
      }

      // Check module status changes
      const { data: currentModules } = await supabase
        .from('analysis_modules')
        .select('module_type, status, output_data')
        .eq('analysis_id', analysisId);

      if (currentModules) {
        for (const mod of currentModules) {
          const prevStatus = lastModuleStatus[mod.module_type];
          if (prevStatus !== mod.status) {
            sendSSE(res, {
              event: 'module_status',
              data: {
                module: mod.module_type,
                status: mod.status,
                hasOutput: !!mod.output_data,
              },
            });
            lastModuleStatus[mod.module_type] = mod.status;

            // If module completed, send the output data
            if (mod.status === 'completed' && mod.output_data) {
              sendSSE(res, {
                event: 'module_output',
                data: {
                  module: mod.module_type,
                  output: mod.output_data,
                },
              });
            }
          }
        }
      }

      // Check analysis status
      const { data: currentAnalysis } = await supabase
        .from('analyses')
        .select('status, progress')
        .eq('id', analysisId)
        .single();

      if (currentAnalysis) {
        if (currentAnalysis.status !== analysis.status) {
          sendSSE(res, {
            event: 'analysis_status',
            data: {
              status: currentAnalysis.status,
              progress: currentAnalysis.progress,
            },
          });

          // Update local tracking
          analysis.status = currentAnalysis.status;
          analysis.progress = currentAnalysis.progress;

          // Check if complete
          if (
            currentAnalysis.status === 'completed' ||
            currentAnalysis.status === 'failed'
          ) {
            isComplete = true;
          }
        } else if (currentAnalysis.progress !== analysis.progress) {
          // Progress update
          sendSSE(res, {
            event: 'progress',
            data: {
              progress: currentAnalysis.progress,
            },
          });
          analysis.progress = currentAnalysis.progress;
        }
      }

      // If complete, send done event and close
      if (isComplete) {
        sendSSE(res, {
          event: 'done',
          data: { status: analysis.status },
        });
        clearInterval(heartbeatInterval);
        res.end();
        return;
      }

      // Schedule next poll
      setTimeout(pollForUpdates, pollInterval);
    } catch (error) {
      console.error('SSE polling error:', error);

      // Send error event
      try {
        sendSSE(res, {
          event: 'error',
          data: { message: 'Stream error occurred' },
        });
      } catch {
        // Connection already closed
      }

      clearInterval(heartbeatInterval);
      res.end();
    }
  };

  // Start polling
  pollForUpdates();

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}
