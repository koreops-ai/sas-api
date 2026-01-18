/**
 * LinkedIn Contacts Module
 * Pulls contact roles for target companies using Apify LinkedIn actor.
 */

import type { ModuleExecutionContext, ModuleResult, LinkedInContactData } from '../types/modules.js';

export async function executeLinkedInContacts(
  context: ModuleExecutionContext
): Promise<ModuleResult<LinkedInContactData>> {
  const startTime = Date.now();

  const agentResults = (context.agent_results ?? []) as Array<Record<string, any>>;
  const contactAgent = agentResults.find((result) => result.agent === 'linkedin_contact_agent');

  const companies = contactAgent?.data?.companies ?? [];
  const summary = contactAgent?.summary ?? 'LinkedIn contact analysis completed.';

  return {
    success: true,
    data: {
      companies,
      summary,
    },
    error: null,
    cost: 0,
    duration_ms: Date.now() - startTime,
    evidence_paths: contactAgent?.evidence_paths ?? [],
  };
}
