/**
 * Revenue Intelligence Module
 * Scrapes reviews × price × multiplier to estimate market revenue
 *
 * Estimated time: 5-15 minutes
 * Can run in parallel: Yes
 * Uses: Playwright for web scraping
 */

import { chromium, type Browser, type Page } from 'playwright';
import type {
  ModuleExecutionContext,
  ModuleResult,
  RevenueIntelligenceData,
  ScrapedProduct,
  MarketAggregation,
  PlatformBreakdown,
  PLATFORM_MULTIPLIERS,
  COVERAGE_FACTORS,
} from '../types/modules.js';
import { storeEvidence, uploadEvidence } from '../lib/supabase.js';
import { sendMessageForJSON } from '../lib/anthropic.js';

// Rate limiting configuration
const SCRAPE_CONFIG = {
  delayBetweenRequests: { min: 2000, max: 5000 }, // 2-5 seconds
  maxConcurrentPages: 3,
  batchSize: 20,
  batchPauseMs: 30000, // 30 seconds between batches
  maxProductsPerPlatform: 50,
};

// Platform selectors and configurations
const PLATFORM_CONFIGS: Record<
  string,
  {
    urlPattern: string;
    selectors: {
      productList: string;
      name: string;
      price: string;
      reviews: string;
      rating: string;
    };
    multiplierKey: keyof typeof PLATFORM_MULTIPLIERS;
  }
> = {
  amazon: {
    urlPattern: 'https://www.amazon.com/s?k={query}',
    selectors: {
      productList: '[data-component-type="s-search-result"]',
      name: 'h2 a span',
      price: '.a-price .a-offscreen',
      reviews: '[aria-label*="stars"] + span',
      rating: '[aria-label*="stars"]',
    },
    multiplierKey: 'amazon',
  },
  udemy: {
    urlPattern: 'https://www.udemy.com/courses/search/?q={query}',
    selectors: {
      productList: '[data-purpose="course-card"]',
      name: '[data-purpose="course-title-url"]',
      price: '[data-purpose="course-price-text"]',
      reviews: '[data-purpose="rating-number"]',
      rating: '[data-purpose="rating-number"]',
    },
    multiplierKey: 'udemy',
  },
  g2: {
    urlPattern: 'https://www.g2.com/search?query={query}',
    selectors: {
      productList: '.product-listing',
      name: '.product-listing__product-name',
      price: '.pricing-info',
      reviews: '.review-count',
      rating: '.star-rating',
    },
    multiplierKey: 'g2',
  },
};

export async function executeRevenueIntelligence(
  context: ModuleExecutionContext
): Promise<ModuleResult<RevenueIntelligenceData>> {
  const startTime = Date.now();
  let totalCost = 0;
  const evidencePaths: string[] = [];
  let browser: Browser | null = null;

  try {
    // Determine search query
    const searchQuery = context.product_name || context.company_name;

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const products: ScrapedProduct[] = [];
    const platformBreakdowns: PlatformBreakdown[] = [];

    // Scrape each configured platform
    for (const [platformName, config] of Object.entries(PLATFORM_CONFIGS)) {
      try {
        const platformProducts = await scrapePlatform(
          browser,
          platformName,
          config,
          searchQuery,
          context.analysis_id,
          context.module_id
        );

        products.push(...platformProducts.products);
        platformBreakdowns.push(platformProducts.breakdown);
        evidencePaths.push(...platformProducts.evidencePaths);
      } catch (error) {
        console.error(`Error scraping ${platformName}:`, error);
        // Continue with other platforms
      }
    }

    // Calculate market aggregation
    const marketAggregation = calculateMarketAggregation(products, platformBreakdowns);

    // Use Claude to analyze and validate the data
    const analysisResult = await analyzeScrapedData(
      context.company_name,
      context.product_name,
      products,
      platformBreakdowns
    );
    totalCost += analysisResult.cost;

    const data: RevenueIntelligenceData = {
      products,
      market_aggregation: marketAggregation,
      platform_breakdown: platformBreakdowns,
    };

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
      error: error instanceof Error ? error.message : 'Unknown error in revenue intelligence',
      cost: totalCost,
      duration_ms: Date.now() - startTime,
      evidence_paths: evidencePaths,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function scrapePlatform(
  browser: Browser,
  platformName: string,
  config: (typeof PLATFORM_CONFIGS)[string],
  searchQuery: string,
  analysisId: string,
  moduleId: string
): Promise<{
  products: ScrapedProduct[];
  breakdown: PlatformBreakdown;
  evidencePaths: string[];
}> {
  const products: ScrapedProduct[] = [];
  const evidencePaths: string[] = [];

  const page = await browser.newPage();

  try {
    // Set user agent to avoid detection
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Navigate to search URL
    const searchUrl = config.urlPattern.replace('{query}', encodeURIComponent(searchQuery));
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Take screenshot as evidence
    const screenshotBuffer = await page.screenshot({ fullPage: false });
    const screenshotPath = `analyses/${analysisId}/screenshots/${platformName}-search.png`;

    const uploadedPath = await uploadEvidence(
      'evidence',
      screenshotPath,
      screenshotBuffer,
      'image/png'
    );
    if (uploadedPath) {
      evidencePaths.push(uploadedPath);
    }

    // Wait for products to load
    await page.waitForSelector(config.selectors.productList, { timeout: 10000 }).catch(() => null);

    // Extract product data
    const productElements = await page.$$(config.selectors.productList);
    const maxProducts = Math.min(productElements.length, SCRAPE_CONFIG.maxProductsPerPlatform);

    for (let i = 0; i < maxProducts; i++) {
      const element = productElements[i];

      try {
        // Add random delay between extractions
        await randomDelay(SCRAPE_CONFIG.delayBetweenRequests.min, SCRAPE_CONFIG.delayBetweenRequests.max);

        const name = await extractText(element, config.selectors.name);
        const priceText = await extractText(element, config.selectors.price);
        const reviewsText = await extractText(element, config.selectors.reviews);
        const ratingText = await extractText(element, config.selectors.rating);

        const price = parsePrice(priceText);
        const reviewCount = parseReviewCount(reviewsText);
        const rating = parseRating(ratingText);

        if (name && price > 0) {
          // Get multiplier for this platform
          const multipliers = getMultipliers(config.multiplierKey);
          const selectedMultiplier = multipliers.moderate;

          const estimatedUnits = reviewCount * selectedMultiplier;
          const estimatedRevenue = estimatedUnits * price;

          products.push({
            name,
            provider: platformName,
            price,
            original_price: null,
            currency: 'USD',
            review_count: reviewCount,
            average_rating: rating,
            rating_distribution: {},
            enrollment_count: null,
            date_listed: null,
            last_updated: null,
            category: searchQuery,
            tags: [],
            url: page.url(),
            screenshot_path: screenshotPath,
            platform: platformName,
            multiplier_used: selectedMultiplier,
            estimated_units: estimatedUnits,
            estimated_revenue: estimatedRevenue,
          });
        }
      } catch (err) {
        console.warn(`Error extracting product ${i} from ${platformName}:`, err);
      }
    }

    // Calculate platform breakdown
    const breakdown: PlatformBreakdown = {
      platform: platformName,
      category: searchQuery,
      products_count: products.length,
      total_reviews: products.reduce((sum, p) => sum + p.review_count, 0),
      total_revenue: products.reduce((sum, p) => sum + p.estimated_revenue, 0),
      average_price: products.length > 0
        ? products.reduce((sum, p) => sum + p.price, 0) / products.length
        : 0,
      multiplier: {
        ...getMultipliers(config.multiplierKey),
        selected: getMultipliers(config.multiplierKey).moderate,
      },
    };

    return { products, breakdown, evidencePaths };
  } finally {
    await page.close();
  }
}

async function extractText(element: any, selector: string): Promise<string> {
  try {
    const el = await element.$(selector);
    if (!el) return '';
    return (await el.textContent()) || '';
  } catch {
    return '';
  }
}

function parsePrice(priceText: string): number {
  const match = priceText.replace(/[^0-9.,]/g, '').match(/[\d,.]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(',', ''));
}

function parseReviewCount(reviewsText: string): number {
  const match = reviewsText.replace(/[^0-9,]/g, '').match(/[\d,]+/);
  if (!match) return 0;
  return parseInt(match[0].replace(',', ''), 10);
}

function parseRating(ratingText: string): number {
  const match = ratingText.match(/[\d.]+/);
  if (!match) return 0;
  return parseFloat(match[0]);
}

function getMultipliers(key: keyof typeof PLATFORM_MULTIPLIERS): {
  conservative: number;
  moderate: number;
  aggressive: number;
} {
  // Import from modules.ts
  const multipliers: Record<string, { conservative: number; moderate: number; aggressive: number }> = {
    amazon: { conservative: 33, moderate: 50, aggressive: 100 },
    udemy: { conservative: 5, moderate: 10, aggressive: 25 },
    g2: { conservative: 7, moderate: 20, aggressive: 50 },
    skillsfuture_general: { conservative: 1, moderate: 1.2, aggressive: 1.5 },
  };
  return multipliers[key] || { conservative: 10, moderate: 20, aggressive: 50 };
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function calculateMarketAggregation(
  products: ScrapedProduct[],
  breakdowns: PlatformBreakdown[]
): MarketAggregation {
  const observableMarket = products.reduce((sum, p) => sum + p.estimated_revenue, 0);
  const totalProducts = products.length;

  // Determine coverage factor based on scrape depth
  let scrapeDepth: 'top_10' | 'top_50' | 'top_100' | 'full_category' = 'top_10';
  let coverageFactor = 0.25;
  let tamMultiplier = 4.5;

  if (totalProducts >= 100) {
    scrapeDepth = 'top_100';
    coverageFactor = 0.75;
    tamMultiplier = 1.33;
  } else if (totalProducts >= 50) {
    scrapeDepth = 'top_50';
    coverageFactor = 0.55;
    tamMultiplier = 1.85;
  } else if (totalProducts >= 10) {
    scrapeDepth = 'top_10';
    coverageFactor = 0.25;
    tamMultiplier = 4.5;
  }

  return {
    observable_market: observableMarket,
    coverage_factor: coverageFactor,
    estimated_tam: observableMarket * tamMultiplier,
    total_products_scraped: totalProducts,
    scrape_depth: scrapeDepth,
  };
}

async function analyzeScrapedData(
  companyName: string,
  productName: string | null,
  products: ScrapedProduct[],
  breakdowns: PlatformBreakdown[]
): Promise<{ analysis: string; cost: number }> {
  const prompt = `Analyze the following scraped market data for ${companyName}${productName ? ` (${productName})` : ''}:

Platform Breakdown:
${JSON.stringify(breakdowns, null, 2)}

Top Products (sample of ${Math.min(10, products.length)}):
${JSON.stringify(products.slice(0, 10), null, 2)}

Provide insights on:
1. Market size validation
2. Price point analysis
3. Competition density
4. Revenue opportunity assessment

Keep the analysis concise and data-driven.`;

  const result = await sendMessageForJSON<{ analysis: string }>(prompt, {
    maxTokens: 2048,
  });

  return {
    analysis: result.data.analysis,
    cost: result.cost,
  };
}
