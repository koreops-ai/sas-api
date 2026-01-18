import { storeEvidence } from '../../supabase.js';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

function getAuthHeader(): string {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    throw new Error('Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD');
  }
  const token = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

export interface DataForSeoKeyword {
  keyword: string;
  search_volume?: number;
  competition?: number;
  cpc?: number;
  difficulty?: number;
}

export async function fetchKeywordMetrics(options: {
  analysisId: string;
  moduleId: string;
  keywords: string[];
  locationName?: string;
  languageCode?: string;
}): Promise<{ keywords: DataForSeoKeyword[]; evidence_paths: string[] }> {
  const payload = [
    {
      keywords: options.keywords,
      location_name: options.locationName ?? 'United States',
      language_code: options.languageCode ?? 'en',
    },
  ];

  const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/keyword_overview/live', {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO Labs error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const items = json?.tasks?.[0]?.result ?? [];
  const keywords: DataForSeoKeyword[] = items.map((item: any) => ({
    keyword: item.keyword,
    search_volume: item.search_volume,
    competition: item.competition,
    cpc: item.cpc,
    difficulty: item.keyword_difficulty,
  }));

  const storagePath = `analyses/${options.analysisId}/dataforseo-keywords.json`;
  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: 'dataforseo:keyword_overview',
    source_type: 'api_response',
    content_type: 'application/json',
    storage_path: storagePath,
    metadata: {
      count: keywords.length,
      location: options.locationName ?? 'United States',
      language: options.languageCode ?? 'en',
    },
  });

  return {
    keywords,
    evidence_paths: evidence ? [storagePath] : [],
  };
}

export async function searchDataForSeo(options: {
  analysisId: string;
  moduleId: string;
  query: string;
  locationName?: string;
  languageCode?: string;
}): Promise<{ results: Array<{ title: string; link: string; snippet?: string }>; evidence_paths: string[] }> {
  const payload = [
    {
      keyword: options.query,
      location_name: options.locationName ?? 'United States',
      language_code: options.languageCode ?? 'en',
      depth: 10,
    },
  ];

  const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO SERP error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const items = json?.tasks?.[0]?.result?.[0]?.items ?? [];
  const results = items
    .filter((item: any) => item.type === 'organic')
    .slice(0, 8)
    .map((item: any) => ({
      title: item.title ?? 'Untitled',
      link: item.url ?? '',
      snippet: item.snippet ?? item.description,
    }));

  const storagePath = `analyses/${options.analysisId}/dataforseo-serp.json`;
  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: 'dataforseo:serp',
    source_type: 'api_response',
    content_type: 'application/json',
    storage_path: storagePath,
    metadata: {
      query: options.query,
      count: results.length,
      location: options.locationName ?? 'United States',
      language: options.languageCode ?? 'en',
    },
  });

  return {
    results,
    evidence_paths: evidence ? [storagePath] : [],
  };
}
