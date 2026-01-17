/**
 * API utility functions for Vercel serverless functions
 * SAS Market Validation Platform
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Send JSON response
 */
export function sendJson<T>(
  res: VercelResponse,
  data: ApiResponse<T>,
  statusCode = 200
): void {
  res.status(statusCode).json(data);
}

/**
 * Send success response
 */
export function sendSuccess<T>(
  res: VercelResponse,
  data: T,
  message?: string,
  statusCode = 200
): void {
  sendJson(res, { success: true, data, message }, statusCode);
}

/**
 * Send error response
 */
export function sendError(
  res: VercelResponse,
  error: string,
  statusCode = 400
): void {
  sendJson(res, { success: false, error }, statusCode);
}

/**
 * Get request body with validation
 */
export async function getRequestBody<T>(
  req: VercelRequest
): Promise<T | null> {
  try {
    if (!req.body) {
      return null;
    }
    // Vercel automatically parses JSON bodies
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return null;
  }
}

/**
 * Get authenticated user ID from request headers
 * Validates JWT tokens from Supabase Auth
 */
export async function getUserId(req: VercelRequest): Promise<string | null> {
  // Try JWT authentication first (Authorization header)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const userId = await validateSupabaseToken(token);
      if (userId) {
        return userId;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      // Fall through to X-User-Id header for backwards compatibility
    }
  }

  // Fallback: X-User-Id header (for development/testing)
  // This should be removed in production
  const userId = req.headers['x-user-id'] as string | undefined;
  return userId || null;
}

/**
 * Validate Supabase JWT token and extract user ID
 */
async function validateSupabaseToken(token: string): Promise<string | null> {
  try {
    // Import Supabase client (we need anon key for JWT verification)
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY!;

    // Create a client with the JWT token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Token validation failed:', error);
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Error validating token:', error);
    return null;
  }
}

/**
 * Require authenticated user
 */
export async function requireAuth(req: VercelRequest): Promise<string> {
  const userId = await getUserId(req);
  if (!userId) {
    throw new Error('Unauthorized: Missing or invalid authentication token');
  }
  return userId;
}

/**
 * Get query parameter
 */
export function getQueryParam(
  req: VercelRequest,
  key: string
): string | undefined {
  const value = req.query[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Get query parameter as number
 */
export function getQueryParamAsNumber(
  req: VercelRequest,
  key: string,
  defaultValue?: number
): number | undefined {
  const value = getQueryParam(req, key);
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Handle async route handler with error catching
 */
export function asyncHandler(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      sendError(res, message, 500);
    }
  };
}

/**
 * CORS headers
 */
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
}

/**
 * Handle OPTIONS request for CORS
 */
export function handleOptions(res: VercelResponse): void {
  setCorsHeaders(res);
  res.status(200).end();
}
