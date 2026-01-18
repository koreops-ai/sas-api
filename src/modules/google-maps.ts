/**
 * Google Maps Module
 * Surfaces local/company intelligence from Google Maps listings.
 */

import type { ModuleExecutionContext, ModuleResult, GoogleMapsData } from '../types/modules.js';

export async function executeGoogleMaps(
  context: ModuleExecutionContext
): Promise<ModuleResult<GoogleMapsData>> {
  const startTime = Date.now();
  const agentResults = (context.agent_results ?? []) as Array<Record<string, any>>;
  const mapsAgent = agentResults.find((result) => result.agent === 'google_maps_agent');

  const places = mapsAgent?.data?.places ?? [];
  const summary = mapsAgent?.summary ?? 'Google Maps analysis completed.';

  return {
    success: true,
    data: {
      summary,
      places,
    },
    error: null,
    cost: 0,
    duration_ms: Date.now() - startTime,
    evidence_paths: mapsAgent?.evidence_paths ?? [],
  };
}
