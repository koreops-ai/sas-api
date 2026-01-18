import { storeEvidence } from '../../supabase.js';

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

export interface SerpApiResult {
  title: string;
  link: string;
  snippet?: string;
}

export interface SerpApiSearchResponse {
  query: string;
  results: SerpApiResult[];
  evidence_paths: string[];
}

export async function searchSerpApi(
  query: string,
  options: {
    analysisId: string;
    moduleId: string;
    tag: string;
  }
): Promise<SerpApiSearchResponse> {
  if (!SERPAPI_API_KEY) {
    throw new Error('Missing SERPAPI_API_KEY environment variable');
  }

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', SERPAPI_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();

  const organic = Array.isArray(payload.organic_results)
    ? payload.organic_results
    : [];

  const results: SerpApiResult[] = organic.slice(0, 8).map((item: any) => ({
    title: item.title ?? 'Untitled',
    link: item.link ?? '',
    snippet: item.snippet,
  }));

  const storagePath = `analyses/${options.analysisId}/serpapi-${options.tag}.json`;
  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: `serpapi:${options.tag}`,
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
  };
}
