import type { AgentContext, AgentResult, AgentType } from './types.js';
import type { ModuleType } from '../../types/database.js';
import { runJsonCompletion } from '../llm/structured.js';
import { searchSerpApi } from './tools/serpapi.js';
import { runLinkedInSearch } from './tools/apify.js';
import { runGoogleMapsSearch } from './tools/apify-maps.js';
import { searchBrave } from './tools/brave.js';
import { fetchKeywordMetrics, searchDataForSeo } from './tools/dataforseo.js';

interface AgentDefinition {
  type: AgentType;
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  run: (context: AgentContext) => Promise<AgentResult>;
}

const MODEL_MAP = {
  keywords_agent: { provider: 'gemini', model: 'gemini-1.5-flash' },
  sentiment_agent: { provider: 'gemini', model: 'gemini-1.5-flash' },
  web_research_agent: { provider: 'gemini', model: 'gemini-1.5-flash' },
  linkedin_contact_agent: { provider: 'gemini', model: 'gemini-1.5-flash' },
  google_maps_agent: { provider: 'gemini', model: 'gemini-1.5-flash' },
} as const;

const SYNTHESIS_MODEL = {
  provider: 'openai' as const,
  model: 'gpt-4o',
};

export const SYNTHESIS_CONFIG = SYNTHESIS_MODEL;

const AGENTS: Record<AgentType, AgentDefinition> = {
  keywords_agent: {
    type: 'keywords_agent',
    ...MODEL_MAP.keywords_agent,
    run: async (context) => {
      const start = Date.now();
      const seedKeyword = `${context.product_name ?? context.company_name}`.trim();
      const keywordMetrics = await fetchKeywordMetrics({
        analysisId: context.analysis_id,
        moduleId: context.module_id,
        keywords: [seedKeyword],
        locationName: context.target_market ?? undefined,
      });

      const systemPrompt =
        'You are a keyword research specialist. Return JSON with keyword insights and sources.';
      const userPrompt = `Company: ${context.company_name}
Product: ${context.product_name ?? 'N/A'}
Target Market: ${context.target_market ?? 'N/A'}
Analysis Memory: ${context.analysis_memory ?? 'None'}
Agent Memory: ${context.agent_memory ?? 'None'}
Keyword Metrics: ${keywordMetrics.keywords.map((k) => `${k.keyword} (vol: ${k.search_volume ?? 'n/a'}, diff: ${k.difficulty ?? 'n/a'}, cpc: ${k.cpc ?? 'n/a'})`).join('; ')}

Return JSON with:
{
  "summary": "...",
  "keywords": [{ "keyword": "...", "intent": "informational|commercial|navigational", "notes": "...", "search_volume": 0, "difficulty": 0, "cpc": 0 }],
  "sources": ["url", "..."]
}`;

      const result = await runJsonCompletion<{
        summary: string;
        keywords: Array<{ keyword: string; intent: string; notes?: string }>;
        sources: string[];
      }>(MODEL_MAP.keywords_agent.provider, MODEL_MAP.keywords_agent.model, systemPrompt, userPrompt);

      return {
        agent: 'keywords_agent',
        summary: result.data.summary,
        data: {
          ...result.data,
          metrics: keywordMetrics.keywords,
        },
        sources: result.data.sources ?? [],
        evidence_paths: keywordMetrics.evidence_paths,
        cost: result.cost,
        duration_ms: Date.now() - start,
        provider: MODEL_MAP.keywords_agent.provider,
        model: MODEL_MAP.keywords_agent.model,
      };
    },
  },
  sentiment_agent: {
    type: 'sentiment_agent',
    ...MODEL_MAP.sentiment_agent,
    run: async (context) => {
      const start = Date.now();
      const query = `${context.product_name ?? context.company_name} reviews sentiment ${context.target_market ?? ''}`.trim();
      const serp = await searchSerpApi(query, {
        analysisId: context.analysis_id,
        moduleId: context.module_id,
        tag: 'sentiment',
      });

      const systemPrompt =
        'You are a sentiment analyst. Use the sources provided to infer sentiment themes.';
      const userPrompt = `Company: ${context.company_name}
Product: ${context.product_name ?? 'N/A'}
Analysis Memory: ${context.analysis_memory ?? 'None'}
Agent Memory: ${context.agent_memory ?? 'None'}
Sources: ${serp.results.map((r) => `- ${r.title} (${r.link}): ${r.snippet ?? ''}`).join('\n')}

Return JSON with:
{
  "summary": "...",
  "sentiment": { "positive": 0, "neutral": 0, "negative": 0, "compound": 0 },
  "themes": [{ "theme": "...", "sentiment": "positive|neutral|negative", "evidence": "..." }],
  "sources": ["url", "..."]
}`;

      const result = await runJsonCompletion<{
        summary: string;
        sentiment: { positive: number; neutral: number; negative: number; compound: number };
        themes: Array<{ theme: string; sentiment: string; evidence: string }>;
        sources: string[];
      }>(MODEL_MAP.sentiment_agent.provider, MODEL_MAP.sentiment_agent.model, systemPrompt, userPrompt);

      return {
        agent: 'sentiment_agent',
        summary: result.data.summary,
        data: result.data,
        sources: result.data.sources ?? serp.results.map((r) => r.link).filter(Boolean),
        evidence_paths: serp.evidence_paths,
        cost: result.cost,
        duration_ms: Date.now() - start,
        provider: MODEL_MAP.sentiment_agent.provider,
        model: MODEL_MAP.sentiment_agent.model,
      };
    },
  },
  web_research_agent: {
    type: 'web_research_agent',
    ...MODEL_MAP.web_research_agent,
    run: async (context) => {
      const start = Date.now();
      const query = `${context.company_name} ${context.product_name ?? ''} market research ${context.target_market ?? ''}`.trim();
      let serpResults: Array<{ title: string; link: string; snippet?: string }> = [];
      let evidencePaths: string[] = [];
      let sources: string[] = [];

      try {
        const serp = await searchDataForSeo({
          analysisId: context.analysis_id,
          moduleId: context.module_id,
          query,
          locationName: context.target_market ?? undefined,
        });
        serpResults = serp.results;
        evidencePaths = serp.evidence_paths;
        sources = serp.results.map((r) => r.link).filter(Boolean);
      } catch {
        if (process.env.SERPAPI_API_KEY) {
          try {
            const serp = await searchSerpApi(query, {
              analysisId: context.analysis_id,
              moduleId: context.module_id,
              tag: 'web-research-serpapi',
            });
            serpResults = serp.results;
            evidencePaths = serp.evidence_paths;
            sources = serp.results.map((r) => r.link).filter(Boolean);
          } catch {
            // fall through to Brave
          }
        }

        if (serpResults.length === 0 && process.env.BRAVE_SEARCH_API_KEY) {
          const brave = await searchBrave(query, {
            analysisId: context.analysis_id,
            moduleId: context.module_id,
            tag: 'web-research',
          });
          serpResults = brave.results;
          evidencePaths = brave.evidence_paths;
          sources = brave.results.map((r) => r.link).filter(Boolean);
        }
      }

      const systemPrompt =
        'You are a web research analyst. Summarize key facts with citations.';
      const userPrompt = `Company: ${context.company_name}
Product: ${context.product_name ?? 'N/A'}
Target Market: ${context.target_market ?? 'N/A'}
Analysis Memory: ${context.analysis_memory ?? 'None'}
Agent Memory: ${context.agent_memory ?? 'None'}
Sources: ${serpResults.map((r) => `- ${r.title} (${r.link}): ${r.snippet ?? ''}`).join('\n')}

Return JSON with:
{
  "summary": "...",
  "facts": [{ "fact": "...", "source": "url" }],
  "sources": ["url", "..."]
}`;

      const result = await runJsonCompletion<{
        summary: string;
        facts: Array<{ fact: string; source: string }>;
        sources: string[];
      }>(MODEL_MAP.web_research_agent.provider, MODEL_MAP.web_research_agent.model, systemPrompt, userPrompt);

      return {
        agent: 'web_research_agent',
        summary: result.data.summary,
        data: result.data,
        sources: result.data.sources ?? sources,
        evidence_paths: evidencePaths,
        cost: result.cost,
        duration_ms: Date.now() - start,
        provider: MODEL_MAP.web_research_agent.provider,
        model: MODEL_MAP.web_research_agent.model,
      };
    },
  },
  linkedin_contact_agent: {
    type: 'linkedin_contact_agent',
    ...MODEL_MAP.linkedin_contact_agent,
    run: async (context) => {
      const start = Date.now();
      const apify = await runLinkedInSearch({
        analysisId: context.analysis_id,
        moduleId: context.module_id,
        company: context.company_name,
        targetMarket: context.target_market,
        maxResults: 25,
      });

      const roleKeywords = ['ceo', 'founder', 'co-founder', 'cto', 'cmo', 'vp', 'head', 'director', 'growth', 'marketing'];
      const scored = apify.contacts.map((contact) => {
        const title = contact.title.toLowerCase();
        const score = roleKeywords.reduce((acc, keyword) => acc + (title.includes(keyword) ? 12 : 0), 10);
        return {
          ...contact,
          relevance_score: Math.min(100, score),
        };
      });

      const systemPrompt =
        'You are a LinkedIn research analyst. Summarize key roles and return JSON.';
      const userPrompt = `Company: ${context.company_name}
Target Market: ${context.target_market ?? 'N/A'}
Contacts:
${scored.map((item) => `- ${item.name} (${item.title}) ${item.profile_url}`).join('\n')}

Return JSON with:
{
  "summary": "...",
  "companies": [
    {
      "company": "${context.company_name}",
      "contacts": [
        { "name": "...", "title": "...", "profile_url": "...", "relevance_score": 0 }
      ]
    }
  ],
  "sources": ["url", "..."]
}`;

      const result = await runJsonCompletion<{
        summary: string;
        companies: Array<{
          company: string;
          contacts: Array<{ name: string; title: string; profile_url: string; relevance_score: number }>;
        }>;
        sources: string[];
      }>(MODEL_MAP.linkedin_contact_agent.provider, MODEL_MAP.linkedin_contact_agent.model, systemPrompt, userPrompt);

      return {
        agent: 'linkedin_contact_agent',
        summary: result.data.summary,
        data: {
          companies: result.data.companies,
          raw_contacts: scored,
        },
        sources: result.data.sources ?? scored.map((item) => item.profile_url).filter(Boolean),
        evidence_paths: apify.evidence_paths,
        cost: result.cost,
        duration_ms: Date.now() - start,
        provider: MODEL_MAP.linkedin_contact_agent.provider,
        model: MODEL_MAP.linkedin_contact_agent.model,
      };
    },
  },
  google_maps_agent: {
    type: 'google_maps_agent',
    ...MODEL_MAP.google_maps_agent,
    run: async (context) => {
      const start = Date.now();
      const searchStrings = [
        context.product_name ?? context.company_name,
      ].filter(Boolean) as string[];
      const maps = await runGoogleMapsSearch({
        analysisId: context.analysis_id,
        moduleId: context.module_id,
        searchStrings,
        locationQuery: context.target_market ?? undefined,
        maxPlaces: 50,
      });

      const systemPrompt =
        'You are a market research analyst. Summarize Google Maps findings and return JSON.';
      const userPrompt = `Company: ${context.company_name}
Product: ${context.product_name ?? 'N/A'}
Target Market: ${context.target_market ?? 'N/A'}
Places:
${maps.places.map((item) => `- ${item.name} (${item.rating ?? 'n/a'}★, ${item.reviews_count ?? 'n/a'} reviews) ${item.address ?? ''} ${item.url ?? ''}`).join('\n')}

Return JSON with:
{
  "summary": "...",
  "places": [
    { "name": "...", "rating": 0, "reviews_count": 0, "address": "...", "website": "...", "url": "..." }
  ],
  "sources": ["url", "..."]
}`;

      const result = await runJsonCompletion<{
        summary: string;
        places: Array<{
          name: string;
          rating?: number;
          reviews_count?: number;
          address?: string;
          website?: string;
          url?: string;
        }>;
        sources: string[];
      }>(MODEL_MAP.google_maps_agent.provider, MODEL_MAP.google_maps_agent.model, systemPrompt, userPrompt);

      return {
        agent: 'google_maps_agent',
        summary: result.data.summary,
        data: {
          places: result.data.places,
          raw_places: maps.places,
        },
        sources: result.data.sources ?? maps.places.map((p) => p.url).filter(Boolean),
        evidence_paths: maps.evidence_paths,
        cost: result.cost,
        duration_ms: Date.now() - start,
        provider: MODEL_MAP.google_maps_agent.provider,
        model: MODEL_MAP.google_maps_agent.model,
      };
    },
  },
};

const MODULE_AGENT_MAP: Record<ModuleType, AgentType[]> = {
  market_demand: ['keywords_agent', 'web_research_agent'],
  revenue_intelligence: ['web_research_agent'],
  competitive_intelligence: ['web_research_agent'],
  social_sentiment: ['sentiment_agent', 'web_research_agent'],
  linkedin_contacts: ['linkedin_contact_agent'],
  google_maps: ['google_maps_agent'],
  financial_modeling: [],
  risk_assessment: ['web_research_agent'],
  operational_feasibility: ['web_research_agent'],
};

export function getAgentsForModule(moduleType: ModuleType): AgentDefinition[] {
  return MODULE_AGENT_MAP[moduleType].map((type) => AGENTS[type]);
}
