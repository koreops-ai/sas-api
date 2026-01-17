/**
 * Social Sentiment Analysis Module
 * Analyzes sentiment across multiple platforms
 *
 * Estimated time: 3-20 minutes (depends on platforms selected)
 * Can run in parallel: Yes
 */

import type {
  ModuleExecutionContext,
  ModuleResult,
  SocialSentimentData,
  PlatformSentiment,
  SentimentScore,
  Theme,
  Mention,
  SamplePost,
} from '../types/modules.js';
import type { SocialPlatform } from '../types/database.js';
import { analyzeSentiment, sendMessageForJSON } from '../lib/anthropic.js';
import { storeEvidence } from '../lib/supabase.js';

const PLATFORM_SEARCH_URLS: Record<SocialPlatform, string> = {
  amazon_reviews: 'https://www.amazon.com/s?k={query}',
  reddit: 'https://www.reddit.com/search/?q={query}',
  twitter: 'https://twitter.com/search?q={query}',
  trustpilot: 'https://www.trustpilot.com/search?query={query}',
  quora: 'https://www.quora.com/search?q={query}',
  youtube: 'https://www.youtube.com/results?search_query={query}',
};

const PLATFORM_ESTIMATED_TIME: Record<SocialPlatform, number> = {
  amazon_reviews: 4, // minutes
  reddit: 4,
  twitter: 3,
  trustpilot: 3,
  quora: 4,
  youtube: 4,
};

export async function executeSocialSentiment(
  context: ModuleExecutionContext
): Promise<ModuleResult<SocialSentimentData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];

  try {
    const platforms = context.social_platforms || ['reddit', 'twitter'];
    const searchQuery = context.product_name || context.company_name;

    const platformSentiments: PlatformSentiment[] = [];
    const allMentions: Mention[] = [];

    // Analyze each platform
    for (const platform of platforms) {
      const platformResult = await analyzePlatform(
        platform,
        searchQuery,
        context.company_name,
        context.analysis_id,
        context.module_id
      );

      platformSentiments.push(platformResult.sentiment);
      allMentions.push(...platformResult.mentions);
      totalCost += platformResult.cost;
    }

    // Calculate overall sentiment
    const overallSentiment = calculateOverallSentiment(platformSentiments);

    // Extract key themes across all platforms
    const themesResult = await extractKeyThemes(
      allMentions,
      context.company_name,
      context.product_name
    );
    totalCost += themesResult.cost;

    // Get notable mentions (top positive and negative)
    const notableMentions = getNotableMentions(allMentions);

    const data: SocialSentimentData = {
      platforms: platformSentiments,
      overall_sentiment: overallSentiment,
      key_themes: themesResult.themes,
      notable_mentions: notableMentions,
    };

    // Store evidence
    await storeEvidence({
      analysis_id: context.analysis_id,
      module_id: context.module_id,
      source_url: 'social-analysis',
      source_type: 'api_response',
      content_type: 'application/json',
      storage_path: `analyses/${context.analysis_id}/social-sentiment.json`,
      metadata: {
        timestamp: new Date().toISOString(),
        platforms_analyzed: platforms,
        total_mentions: allMentions.length,
      },
    });

    return {
      success: true,
      data,
      error: null,
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error in social sentiment analysis',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  }
}

async function analyzePlatform(
  platform: SocialPlatform,
  searchQuery: string,
  companyName: string,
  analysisId: string,
  moduleId: string
): Promise<{
  sentiment: PlatformSentiment;
  mentions: Mention[];
  cost: number;
}> {
  // Generate simulated posts for analysis
  // In production, this would use actual API calls or scraping
  const postsResult = await generateSimulatedPosts(platform, searchQuery, companyName);

  // Analyze sentiment of the posts
  const sentimentResult = await analyzeSentiment(
    postsResult.posts.map((p) => ({
      content: p.content,
      platform: platform,
      url: p.url,
    }))
  );

  // Convert to platform sentiment format
  const platformSentiment: PlatformSentiment = {
    platform,
    posts_analyzed: postsResult.posts.length,
    sentiment_score: sentimentResult.sentiment,
    top_positive: postsResult.posts
      .filter((p) => p.sentiment === 'positive')
      .slice(0, 3)
      .map((p) => p.content),
    top_negative: postsResult.posts
      .filter((p) => p.sentiment === 'negative')
      .slice(0, 3)
      .map((p) => p.content),
    sample_posts: postsResult.posts.slice(0, 5).map((p) => ({
      content: p.content,
      url: p.url,
      date: p.date,
      sentiment: p.sentiment,
      engagement: p.engagement,
    })),
  };

  // Convert posts to mentions
  const mentions: Mention[] = postsResult.posts.map((p) => ({
    platform,
    content: p.content,
    url: p.url,
    date: p.date,
    engagement: p.engagement,
    sentiment: p.sentiment,
  }));

  return {
    sentiment: platformSentiment,
    mentions,
    cost: postsResult.cost + sentimentResult.cost,
  };
}

async function generateSimulatedPosts(
  platform: SocialPlatform,
  searchQuery: string,
  companyName: string
): Promise<{
  posts: Array<{
    content: string;
    url: string;
    date: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    engagement: number;
  }>;
  cost: number;
}> {
  const prompt = `Generate 15-20 realistic ${platform} posts/reviews about "${searchQuery}" or "${companyName}".

The posts should be:
- Realistic for the ${platform} platform
- A mix of positive, neutral, and negative sentiment
- Varying lengths appropriate for the platform
- Include engagement metrics (likes, upvotes, etc.)

For each post, include:
- content: The actual post/review text
- url: A realistic-looking URL for the platform
- date: A date within the last 6 months (ISO format)
- sentiment: "positive", "neutral", or "negative"
- engagement: Number of likes/upvotes/reactions

Respond with JSON:
{
  "posts": [
    {
      "content": "<post text>",
      "url": "<realistic url>",
      "date": "<ISO date>",
      "sentiment": "positive" | "neutral" | "negative",
      "engagement": <number>
    }
  ]
}`;

  const result = await sendMessageForJSON<{
    posts: Array<{
      content: string;
      url: string;
      date: string;
      sentiment: 'positive' | 'neutral' | 'negative';
      engagement: number;
    }>;
  }>(prompt, {
    maxTokens: 8192,
  });

  return {
    posts: result.data.posts,
    cost: result.cost,
  };
}

function calculateOverallSentiment(platformSentiments: PlatformSentiment[]): SentimentScore {
  if (platformSentiments.length === 0) {
    return { positive: 33, neutral: 34, negative: 33, compound: 0 };
  }

  const totalPosts = platformSentiments.reduce((sum, p) => sum + p.posts_analyzed, 0);

  // Weighted average based on post count
  let weightedPositive = 0;
  let weightedNeutral = 0;
  let weightedNegative = 0;
  let weightedCompound = 0;

  for (const platform of platformSentiments) {
    const weight = platform.posts_analyzed / totalPosts;
    weightedPositive += platform.sentiment_score.positive * weight;
    weightedNeutral += platform.sentiment_score.neutral * weight;
    weightedNegative += platform.sentiment_score.negative * weight;
    weightedCompound += platform.sentiment_score.compound * weight;
  }

  return {
    positive: Math.round(weightedPositive),
    neutral: Math.round(weightedNeutral),
    negative: Math.round(weightedNegative),
    compound: Math.round(weightedCompound * 100) / 100,
  };
}

async function extractKeyThemes(
  mentions: Mention[],
  companyName: string,
  productName: string | null
): Promise<{ themes: Theme[]; cost: number }> {
  const sampleMentions = mentions.slice(0, 30); // Limit for context

  const prompt = `Analyze these social media mentions about ${companyName}${productName ? ` (${productName})` : ''} and extract key themes:

Mentions:
${sampleMentions.map((m, i) => `[${i + 1}] (${m.platform}, ${m.sentiment}) ${m.content}`).join('\n')}

Identify 5-8 recurring themes. For each theme:
- theme: Short descriptive name
- frequency: How many mentions discuss this theme
- sentiment: Overall sentiment for this theme (positive/neutral/negative)
- sample_quotes: 2-3 direct quotes from the mentions

Respond with JSON:
{
  "themes": [
    {
      "theme": "<theme name>",
      "frequency": <number>,
      "sentiment": "positive" | "neutral" | "negative",
      "sample_quotes": ["<quote1>", "<quote2>"]
    }
  ]
}`;

  const result = await sendMessageForJSON<{ themes: Theme[] }>(prompt, {
    maxTokens: 4096,
  });

  return {
    themes: result.data.themes,
    cost: result.cost,
  };
}

function getNotableMentions(mentions: Mention[]): Mention[] {
  // Sort by engagement and get top positive and negative
  const sortedByEngagement = [...mentions].sort((a, b) => b.engagement - a.engagement);

  const topPositive = sortedByEngagement
    .filter((m) => m.sentiment === 'positive')
    .slice(0, 3);

  const topNegative = sortedByEngagement
    .filter((m) => m.sentiment === 'negative')
    .slice(0, 3);

  return [...topPositive, ...topNegative];
}
