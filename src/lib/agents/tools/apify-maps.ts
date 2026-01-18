import { storeEvidence } from '../../supabase.js';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_GOOGLE_MAPS_ACTOR_ID = process.env.APIFY_GOOGLE_MAPS_ACTOR_ID;

export interface ApifyMapsPlace {
  name: string;
  address?: string;
  rating?: number;
  reviews_count?: number;
  website?: string;
  phone?: string;
  url?: string;
}

export interface ApifyMapsResponse {
  places: ApifyMapsPlace[];
  evidence_paths: string[];
}

export async function runGoogleMapsSearch(options: {
  analysisId: string;
  moduleId: string;
  searchStrings: string[];
  locationQuery?: string | null;
  maxPlaces?: number;
}): Promise<ApifyMapsResponse> {
  if (!APIFY_API_TOKEN || !APIFY_GOOGLE_MAPS_ACTOR_ID) {
    throw new Error('Missing APIFY_API_TOKEN or APIFY_GOOGLE_MAPS_ACTOR_ID');
  }

  const payload = {
    includeWebResults: false,
    language: 'en',
    locationQuery: options.locationQuery ?? 'United States',
    maxCrawledPlacesPerSearch: options.maxPlaces ?? 50,
    maxImages: 0,
    maximumLeadsEnrichmentRecords: 0,
    scrapeContacts: false,
    scrapeDirectories: false,
    scrapeImageAuthors: false,
    scrapePlaceDetailPage: false,
    scrapeReviewsPersonalData: true,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: false,
      tiktoks: false,
      twitters: false,
      youtubes: false,
    },
    scrapeTableReservationProvider: false,
    searchStringsArray: options.searchStrings,
    skipClosedPlaces: false,
  };

  const runUrl = new URL(`https://api.apify.com/v2/acts/${APIFY_GOOGLE_MAPS_ACTOR_ID}/runs`);
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
  const runPayload = (await runResponse.json()) as any;
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
  const items = (await datasetResponse.json()) as any;

  const places: ApifyMapsPlace[] = (Array.isArray(items) ? items : []).map((item: any) => ({
    name: item.title ?? item.name ?? 'Unknown',
    address: item.address ?? item.fullAddress,
    rating: typeof item.totalScore === 'number' ? item.totalScore : item.rating,
    reviews_count: item.reviewsCount ?? item.reviewCount,
    website: item.website ?? item.websiteUrl,
    phone: item.phone ?? item.phoneNumber,
    url: item.url ?? item.placeUrl,
  }));

  const storagePath = `analyses/${options.analysisId}/google-maps.json`;
  const evidence = await storeEvidence({
    analysis_id: options.analysisId,
    module_id: options.moduleId,
    source_url: 'apify:google_maps',
    source_type: 'api_response',
    content_type: 'application/json',
    storage_path: storagePath,
    metadata: {
      search_strings: options.searchStrings,
      location: options.locationQuery ?? 'United States',
      result_count: places.length,
      dataset_id: datasetId,
    },
  });

  return {
    places,
    evidence_paths: evidence ? [storagePath] : [],
  };
}
