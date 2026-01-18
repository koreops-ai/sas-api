import { storeEvidence } from '../../supabase.js';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_LINKEDIN_ACTOR_ID = process.env.APIFY_LINKEDIN_ACTOR_ID;

export interface ApifyLinkedInContact {
  name: string;
  title: string;
  company: string;
  profile_url: string;
  location?: string;
}

export interface ApifyLinkedInResponse {
  contacts: ApifyLinkedInContact[];
  evidence_paths: string[];
}

export async function runLinkedInSearch(options: {
  analysisId: string;
  moduleId: string;
  company: string;
  targetMarket?: string | null;
  maxResults?: number;
  profileUrls?: string[];
}): Promise<ApifyLinkedInResponse> {
  if (!APIFY_API_TOKEN || !APIFY_LINKEDIN_ACTOR_ID) {
    throw new Error('Missing APIFY_API_TOKEN or APIFY_LINKEDIN_ACTOR_ID');
  }

  const payload =
    options.profileUrls && options.profileUrls.length > 0
      ? {
          profileUrls: options.profileUrls,
        }
      : {
          searchQuery: `${options.company} ${options.targetMarket ?? ''}`.trim(),
          maxItems: options.maxResults ?? 25,
        };

  const runUrl = new URL(`https://api.apify.com/v2/acts/${APIFY_LINKEDIN_ACTOR_ID}/runs`);
  runUrl.searchParams.set('token', APIFY_API_TOKEN);
  runUrl.searchParams.set('waitForFinish', '120');

  const runResponse = await fetch(runUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!runResponse.ok) {
    throw new Error(`Apify run failed: ${runResponse.status} ${runResponse.statusText}`);
  }
  const runPayload = await runResponse.json();
  const datasetId = runPayload?.data?.defaultDatasetId as string | undefined;
  if (!datasetId) {
    throw new Error('Apify run did not return dataset');
  }

  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
  datasetUrl.searchParams.set('clean', 'true');
  datasetUrl.searchParams.set('token', APIFY_API_TOKEN);

  const datasetResponse = await fetch(datasetUrl.toString());
  if (!datasetResponse.ok) {
    throw new Error(`Apify dataset fetch failed: ${datasetResponse.status} ${datasetResponse.statusText}`);
  }
  const items = await datasetResponse.json();

  const contacts: ApifyLinkedInContact[] = (Array.isArray(items) ? items : []).map((item: any) => ({
    name: item.name ?? item.fullName ?? 'Unknown',
    title: item.title ?? item.position ?? 'Unknown',
    company: item.companyName ?? options.company,
    profile_url: item.profileUrl ?? item.url ?? '',
    location: item.location,
  }));

  const storagePath = `analyses/${options.analysisId}/linkedin-contacts.json`;
  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: 'apify:linkedin_contacts',
    source_type: 'api_response',
    content_type: 'application/json',
    storage_path: storagePath,
    metadata: {
      company: options.company,
      result_count: contacts.length,
      dataset_id: datasetId,
    },
  });

  return {
    contacts,
    evidence_paths: evidence ? [storagePath] : [],
  };
}
