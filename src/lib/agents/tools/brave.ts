import { storeEvidence } from '../../supabase.js';

const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const BRAVE_COOLDOWN_MS = 5 * 60 * 1000;
let braveCooldownUntil = 0;

export interface BraveSearchResult {
  title: string;
  link: string;
  snippet?: string;
}

export interface BraveSearchResponse {
  query: string;
  results: BraveSearchResult[];
  evidence_paths: string[];
  rate_limited: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < 3) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        braveCooldownUntil = Date.now() + BRAVE_COOLDOWN_MS;
        return response;
      }
      if (response.status >= 500) {
        await sleep(500 * (attempt + 1));
        attempt += 1;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Brave search failed');
      await sleep(500 * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError ?? new Error('Brave search failed');
}

export async function searchBrave(
  query: string,
  options: {
    analysisId: string;
    moduleId: string;
    tag: string;
  }
): Promise<BraveSearchResponse> {
  if (!BRAVE_SEARCH_API_KEY) {
    throw new Error('Missing BRAVE_SEARCH_API_KEY environment variable');
  }

  if (Date.now() < braveCooldownUntil) {
    return { query, results: [], evidence_paths: [], rate_limited: true };
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '8');

  const response = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': BRAVE_SEARCH_API_KEY,
    },
  });

  if (response.status === 429) {
    return { query, results: [], evidence_paths: [], rate_limited: true };
  }

  if (!response.ok) {
    throw new Error(`Brave Search error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const rawResults = Array.isArray(payload?.web?.results) ? payload.web.results : [];
  const results: BraveSearchResult[] = rawResults.slice(0, 8).map((item: any) => ({
    title: item.title ?? 'Untitled',
    link: item.url ?? '',
    snippet: item.description ?? item.snippet,
  }));

  const storagePath = `analyses/${options.analysisId}/brave-${options.tag}.json`;
  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: `brave:${options.tag}`,
    source_type: 'api_response',
    content_type: 'application/json',
    storage_path: storagePath,
    metadata: {
      query,
      result_count: results.length,
    },
  });

  return {
    query,
    results,
    evidence_paths: evidence ? [storagePath] : [],
    rate_limited: false,
  };
}
