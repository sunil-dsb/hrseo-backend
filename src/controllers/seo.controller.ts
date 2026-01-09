import { type Request, type Response } from "express";
import { sendError, sendSuccessUnencrypted } from "@/utils/response";
import { createMozApiService } from "@/services/mozApi.service";
import { createDataForSeoApiService } from "@/services/dataForSeoApi.service";
import { createOpenAiApiService } from "@/services/openAiApi.service";
import { logger } from "@/utils/logger";
import type { BacklinksSummaryResponse } from "@/types/dataforseo-types";

// Initialize services with environment variables
// Moz API supports either direct token or accessId:secretKey
const mozService = createMozApiService(
  process.env.MOZ_TOKEN
    ? { token: process.env.MOZ_TOKEN }
    : {
        accessId: process.env.MOZ_ACCESS_ID || "",
        secretKey: process.env.MOZ_SECRET_KEY || "",
      }
);

const dataForSeoService = createDataForSeoApiService({
  login: process.env.DATAFORSEO_LOGIN || "",
  password: process.env.DATAFORSEO_PASSWORD || "",
  dataforseo_url: process.env.DATAFORSEO_URL || "",
});

const openAiService = createOpenAiApiService({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * SERP Competitors Analysis
 * POST /api/seo/serp-competitors
 */
export const getSerpCompetitors = async (req: Request, res: Response) => {
  try {
    const { keyword, locationCodeGoogle, languageCode, countryIsoCode, fallbackLocale } = req.body;

    // if (!keyword || !locationCodeGoogle || !languageCode) {
    //   return sendError(
    //     res,
    //     400,
    //     "Missing required fields: keyword, locationCodeGoogle, languageCode"
    //   );
    // }

    // 1. Get SERP results from DataForSEO
    // Returns:
    // - Top 10 ranking URLs → Used to identify real organic competitors
    // - Page titles & descriptions → Used to infer search intent and content patterns
    // - Ranking positions → Domain metrics, Backlink checks, Keyword difficulty estimation
    const serpResults = await dataForSeoService.getGoogleSerp({
      keyword,
      location_code: locationCodeGoogle,
      language_code: languageCode,
      device: "desktop",
    });

    if (
      !serpResults?.tasks?.[0]?.result?.[0]?.items ||
      serpResults.tasks[0].result[0].items.length === 0
    ) {
      return sendError(res, 404, "No SERP results found");
    }

    const serpItems = serpResults.tasks[0].result[0].items;

    // 2. Get keyword difficulty from Moz
    // Returns:
    // - Difficulty score (0–100) → Used to classify ranking difficulty (easy 0–30 / medium 31–60 / hard 61–100)
    // - Search volume → Used to prioritize keywords by traffic potential
    // - Organic CTR → Used to estimate achievable organic traffic
    let keywordDifficulty = null;
    try {
      const locale = `${languageCode}-${countryIsoCode || "US"}`;
      const kdResult = await mozService.getKeywordDifficulty({
        keyword,
        locale,
        device: "desktop",
        engine: "google",
      });
      keywordDifficulty = kdResult?.result?.keyword_metrics?.difficulty;
    } catch (error) {
      logger.warn("Failed to get keyword difficulty", { error });
      // Try fallback locale if provided
      if (fallbackLocale) {
        try {
          const kdResult = await mozService.getKeywordDifficulty({
            keyword,
            locale: fallbackLocale,
            device: "desktop",
            engine: "google",
          });
          keywordDifficulty = kdResult?.result?.keyword_metrics?.difficulty;
        } catch (fallbackError) {
          logger.warn("Failed to get keyword difficulty with fallback", {
            error: fallbackError,
          });
        }
      }
    }

    // 3. Get site metrics for each SERP result
    // Returns:
    // - Domain Authority (DA, 0–100) → Used to compare overall domain strength against competitors (Higher = easier to rank)
    // - Page Authority (PA, 0–100) → Used to evaluate how hard it is to outrank a specific page (Higher = easier to rank)
    // - Root Domains to Root Domain (number of unique referring domains) → Used to assess backlink quality and site authority
    // - Spam Score (0–17) → Used to avoid risky or low-quality domains (0–1	Very clean, 2–4	Low risk, 5–7	Medium risk, 8–11	High risk, 12–17	Very high risk)
    const siteQueries = serpItems.slice(0, 10).map((item: any) => ({
      query: item.url,
      scope: "url" as const,
    }));

    const siteMetricsResults = await mozService.getMultipleSiteMetrics({
      site_queries: siteQueries,
    });

    // 4. Process and combine results
    const competitors = serpItems.slice(0, 10).map((item: any, index: number) => {
      const metrics = siteMetricsResults?.results_by_site?.[index]?.site_metrics;

      return {
        url: item.url,
        title: item.title,
        description: item.description,
        rankGroup: item.rank_group,
        rankAbsolute: item.rank_absolute,
        domain: metrics?.root_domain || "",
        domainAuthority: metrics?.domain_authority || 0,
        pageAuthority: metrics?.page_authority || 0,
        rootDomains: metrics?.root_domains_to_root_domain || 0,
        spamScore: metrics?.spam_score || 0,
        externalPagesToRootDomain: metrics?.external_pages_to_root_domain || 0,
        // Calculate CF (Citation Flow) and TF (Trust Flow) (simplified version - you may want to implement the full algorithm)
        // CF = Measures “popularity” of a page or domain based on how many backlinks it has.
        // TF = Measures “trustworthiness” of a page or domain based on quality of backlinks.
        cf: calculateCF(metrics),
        tf: calculateTF(metrics),
      };
    });

    // 5. Calculate overall keyword difficulty based on competitors
    const calculatedKD = calculateKeywordDifficulty(competitors);

    return sendSuccessUnencrypted(
      res,
      {
        keyword,
        keywordDifficulty: keywordDifficulty || calculatedKD,
        competitors,
        serpResults: serpResults.tasks[0].result[0],
      },
      "SERP competitors analysis completed"
    );
  } catch (error: any) {
    logger.error("SERP Competitors Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to analyze SERP competitors");
  }
};

/**
 * Backlinks Checker
 * POST /api/seo/backlinks
 */
export const getBacklinks = async (req: Request, res: Response) => {
  try {
    const { domain, limit = 25, offset, sort = "source_page_authority" } = req.body;

    if (!domain) {
      return sendError(res, 400, "Domain is required");
    }

    // Get backlinks from Moz
    const backlinksResult = await mozService.getBacklinksList({
      query: domain,
      scope: "url",
      limit,
      offset,
      sort,
      filters: ["external"],
    });

    const backlinks = backlinksResult?.links || [];
    const nextOffset = backlinksResult?.offset?.token;

    return sendSuccessUnencrypted(
      res,
      {
        backlinks: backlinks.map((link: any) => ({
          sourceUrl: link.source_site_metrics?.page || "",
          sourceDomain: link.source_site_metrics?.root_domain || "",
          sourceDA: link.source_site_metrics?.domain_authority || 0,
          sourcePA: link.source_site_metrics?.page_authority || 0,
          targetUrl: link.target_site_metrics?.page || "",
          targetDomain: link.target_site_metrics?.root_domain || "",
          anchorText: link.anchor_text || "",
          dateFirstSeen: link.date_first_seen || "",
          dateLastSeen: link.date_last_seen || "",
          nofollow: link.nofollow || false,
          redirect: link.redirect || false,
        })),
        pagination: {
          limit,
          nextOffset,
          hasMore: !!nextOffset,
        },
        total: backlinks.length,
      },
      "Backlinks retrieved successfully"
    );
  } catch (error: any) {
    logger.error("Backlinks Checker Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to retrieve backlinks");
  }
};

/**
 * Domain Metrics
 * POST /api/seo/domain-metrics
 */
export const getDomainMetrics = async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return sendError(res, 400, "Domain is required");
    }

    // Format domain (remove protocol, www, trailing slash)
    const formattedDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
      .trim();

    const httpDomain = `https://${formattedDomain}/`;

    // 1. Get site metrics from Moz
    const siteMetrics = await mozService.getSiteMetrics({
      query: httpDomain,
      scope: "domain",
    });

    // 2. Get site metrics distributions
    const distributions = await mozService.getSiteMetricsDistributions({
      query: httpDomain,
      scope: "url",
    });

    // 3. Get top referring domains
    const topReferringDomains = await mozService.getTopReferringDomains({
      query: httpDomain,
      scope: "url",
      limit: 25,
    });

    // 4. Get backlinks summary from DataForSEO
    let backlinksSummary: BacklinksSummaryResponse | null = null;
    try {
      backlinksSummary = await dataForSeoService.getBacklinksSummary({
        target: formattedDomain,
        rank_scale: "one_hundred",
        backlinks_filters: ["dofollow", "=", "true"],
      });
    } catch (error) {
      logger.warn("Failed to get backlinks summary", { error });
    }

    // 5. Get backlinks history from DataForSEO
    let backlinksHistory = null;
    try {
      const dateTo = new Date().toISOString().slice(0, 10);
      const dateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      backlinksHistory = await dataForSeoService.getBacklinksHistory({
        target: formattedDomain,
        date_from: dateFrom,
        date_to: dateTo,
        rank_scale: "one_hundred",
      });
    } catch (error) {
      logger.warn("Failed to get backlinks history", { error });
    }

    // 6. Get anchors from DataForSEO
    let anchors = null;
    try {
      anchors = await dataForSeoService.getAnchors({
        target: domain,
        limit: 25,
      });
    } catch (error) {
      logger.warn("Failed to get anchors", { error });
    }

    // Process backlinks history data
    const historyData = processBacklinksHistory(backlinksHistory);
    const summaryData = processBacklinksSummary(backlinksSummary);

    return sendSuccessUnencrypted(
      res,
      {
        domain: formattedDomain,
        siteMetrics: siteMetrics?.site_metrics || {},
        distributions: distributions?.site_metrics_distributions || {},
        topReferringDomains:
          topReferringDomains?.linking_domains?.map((domain: any) => ({
            domain: domain.site_metrics?.root_domain || "",
            da: domain.site_metrics?.domain_authority || 0,
            pa: domain.site_metrics?.page_authority || 0,
            links: domain.site_metrics?.pages_to_root_domain || 0,
          })) || [],
        backlinksSummary: summaryData,
        backlinksHistory: historyData,
        anchors:
          anchors?.tasks?.[0]?.result?.[0]?.items?.map((anchor: any) => ({
            anchorText: anchor.anchor || "",
            referringDomains: anchor.referring_domains || 0,
            total: anchor.backlinks || 0,
          })) || [],
      },
      "Domain metrics retrieved successfully"
    );
  } catch (error: any) {
    logger.error("Domain Metrics Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to retrieve domain metrics");
  }
};

// Helper functions

function calculateCF(metrics: any): number {
  if (!metrics) return 0;

  // Constants for scaling
  const CF_BASE = 10; // base CF for any site
  const CF_LOG_WEIGHT = 45; // main weight for log-scaled root domains
  const CF_INDIRECT_BOOST = 0.25; // small boost for indirect root domains
  const CF_VOLUME_WEIGHT = 0.2; // weight for external pages volume

  // Main metric: root domains linking to root domain
  const rootDomains = Math.max(metrics.root_domains_to_root_domain || 0, 1);

  // Optional: external pages linking to root domain
  const externalPages = Math.max(metrics.external_pages_to_root_domain || 0, 1);

  // Optional: indirect root domains
  const indirectDomains = Math.max(metrics.indirect_root_domains_to_root_domain || 0, 0);

  // Logarithmic compression for huge numbers
  const rootDomainsLog = Math.log1p(rootDomains);
  const externalPagesLog = Math.log1p(externalPages) * CF_VOLUME_WEIGHT;
  const indirectBoost = Math.log1p(indirectDomains) * CF_INDIRECT_BOOST;

  // Combine factors
  let cfRaw =
    CF_BASE + CF_LOG_WEIGHT * Math.log1p(rootDomainsLog + externalPagesLog + indirectBoost);

  // Cap between 0 and 100
  const cf = Math.max(0, Math.min(100, Math.round(cfRaw)));

  return cf;
}

function calculateTF(metrics: any): number {
  if (!metrics) return 0;

  // Constants for scaling
  const TF_BASE = 8.5;
  const TF_LOG_WEIGHT = 5.78;
  const TF_LOG_SCALING = 6.5;
  const TF_PA_WEIGHT = 0.6; // page authority weight
  const TF_DA_WEIGHT = 0.4; // domain authority weight
  const TF_INDIRECT_BOOST = 0.2; // boost for indirect root domains
  const TF_SPAM_EXP = 1.3; // spam exponent

  // Core metrics
  const pageAuthority = metrics.page_authority || 0;
  const domainAuthority = metrics.domain_authority || 0;
  const rootDomains = Math.max(metrics.root_domains_to_root_domain || 0, 1);
  const indirectDomains = Math.max(metrics.indirect_root_domains_to_root_domain || 0, 0);
  const spamScore = metrics.spam_score || 0; // 0–17

  // Trust seed (page + domain authority)
  const trustSeed = pageAuthority * TF_PA_WEIGHT + domainAuthority * TF_DA_WEIGHT;

  // Root domain factor (number of linking domains)
  const rootDomainFactor = Math.log1p(rootDomains);

  // Indirect domain boost
  const indirectBoost = Math.log1p(indirectDomains) * TF_INDIRECT_BOOST;

  // Spam penalty (sigmoid-like)
  const spamPenalty = 1 / (1 + Math.pow(spamScore, TF_SPAM_EXP));

  // Raw TF
  const tfRaw =
    TF_BASE +
    TF_LOG_WEIGHT * Math.log1p(trustSeed * TF_LOG_SCALING + rootDomainFactor + indirectBoost);

  // Apply spam penalty and cap
  const tf = Math.max(0, Math.min(100, Math.round(tfRaw * spamPenalty)));

  return tf;
}

function calculateKeywordDifficulty(competitors: any[]): number {
  if (!competitors || competitors.length === 0) return 0;

  const weights = {
    tf: 0.3,
    da: 0.25,
    cf: 0.2,
    pa: 0.15,
    rd_factor: 0.1,
  };

  // max root domains for normalization
  const maxRD = Math.max(...competitors.map((c) => c.rootDomains));

  const scores = competitors.slice(0, 10).map((comp) => {
    const rdFactor = maxRD > 0 ? (Math.log1p(comp.rootDomains) / Math.log1p(maxRD)) * 50 : 0;

    return (
      weights.tf * comp.tf +
      weights.da * comp.domainAuthority +
      weights.cf * comp.cf +
      weights.pa * comp.pageAuthority +
      weights.rd_factor * rdFactor
    );
  });

  const avgStrength = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Sigmoid scaling for final KD (optional, smoother than linear)
  const kd = Math.max(
    0,
    Math.min(100, Math.round(100 / (1 + Math.exp(-0.05 * (avgStrength - 50)))))
  );

  return kd;
}

function processBacklinksHistory(data: any) {
  if (!data?.tasks?.[0]?.result?.[0]?.items) return null;

  const items = data.tasks[0].result[0].items;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return items.map((item: any) => {
    const date = item.date?.split(" ")[0] || "";
    const d = new Date(date);
    const month = date.slice(0, 7);
    const monthName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    return {
      date,
      month,
      monthName,
      rank: item.rank || 0,
      backlinks: item.backlinks || 0,
      newBacklinks: item.new_backlinks || 0,
      lostBacklinks: item.lost_backlinks || 0,
    };
  });
}

function processBacklinksSummary(data: any) {
  if (!data?.tasks?.[0]?.result?.[0]) return null;

  const item = data.tasks[0].result[0];
  const typesObj = item.referring_links_types || {};
  const types = Object.keys(typesObj);
  const values = Object.values(typesObj);

  const activeLinksRatio = item.backlinks
    ? (item.backlinks - (item.broken_backlinks || 0)) / item.backlinks
    : 0;

  const dofollowLinksRatio = item.backlinks ? item.referring_pages / item.backlinks : 0;

  const avgLinksPerDomain = item.referring_domains
    ? item.referring_pages / item.referring_domains
    : 0;

  const avgLinksPerIP = item.referring_ips ? item.referring_pages / item.referring_ips : 0;

  const avgLinksPerSubnet = item.referring_subnets
    ? item.referring_pages / item.referring_subnets
    : 0;

  return {
    rank: item.rank || 0,
    referringIPs: item.referring_ips || 0,
    referringSubnets: item.referring_subnets || 0,
    referringDomains: item.referring_domains || 0,
    backlinks: item.backlinks || 0,
    referringPages: item.referring_pages || 0,
    linkTypes: {
      types,
      values,
    },
    activeLinksRatio,
    dofollowLinksRatio,
    avgLinksPerDomain,
    avgLinksPerIP,
    avgLinksPerSubnet,
    referringLinksCountries: item.referring_links_countries || {},
    referringLinksTLDs: item.referring_links_tld || {},
  };
}

/**
 * Opportunity Finder - Generate and analyze keywords
 * POST /api/seo/opportunity-finder
 */
export const findOpportunities = async (req: Request, res: Response) => {
  try {
    const {
      niche,
      subNiche,
      businessModel,
      googleLanguageCode,
      googleLocationCode,
      googleLanguageName,
    } = req.body;

    // if (!niche || !googleLanguageCode || !googleLocationCode || !googleLanguageName) {
    //   return sendError(
    //     res,
    //     400,
    //     "Missing required fields: niche, googleLanguageCode, googleLocationCode, googleLanguageName"
    //   );
    // }

    // 1. Generate keywords using OpenAI
    let generatedKeywords = "";
    let totalTokens = 0;

    try {
      const openAiResponse = await openAiService.generateKeywords({
        niche,
        subNiche: subNiche || undefined,
        businessModel: businessModel || "No Business Model",
        languageName: googleLanguageName,
        languageCode: googleLanguageCode,
      });

      generatedKeywords = openAiResponse?.choices?.[0]?.message?.content || "";
      totalTokens = openAiResponse?.usage?.total_tokens || 0;
    } catch (error: any) {
      logger.error("OpenAI Keyword Generation Error", {
        error: error.message,
      });
      return sendError(res, 500, `Failed to generate keywords: ${error.message}`);
    }

    if (!generatedKeywords) {
      return sendError(res, 500, "No keywords generated");
    }

    // 2. Split and format keywords
    const keywords = generatedKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      return sendError(res, 500, "No valid keywords found");
    }

    // 3. Get keyword metrics from DataForSEO
    let keywordMetrics = null;
    try {
      keywordMetrics = await dataForSeoService.getKeywordsForKeywords({
        keywords,
        location_code: googleLocationCode,
        language_code: googleLanguageCode,
        sort_by: "search_volume",
      });
    } catch (error: any) {
      logger.error("DataForSEO Keywords API Error", {
        error: error.message,
      });
      return sendError(res, 500, `Failed to get keyword metrics: ${error.message}`);
    }

    // 4. Process and filter results
    const allResults: any[] = [];

    // Collect all results from tasks
    if (keywordMetrics?.tasks) {
      for (const task of keywordMetrics.tasks) {
        if (task.result && task.result.length > 0) {
          allResults.push(...task.result);
        }
      }
    }

    // Filter NON_BRAND keywords
    const NON_BRAND = "NON_BRAND";
    const filteredResults = allResults.filter((result) => {
      const annotations = result.keyword_annotations;
      if (!annotations?.concepts || annotations.concepts.length === 0) {
        return false;
      }

      return annotations.concepts.some((concept: any) => concept.concept_group?.type === NON_BRAND);
    });
    // console.log(JSON.stringify(keywordMetrics), allResults, filteredResults, '222222222222')
    // Sort by search volume and take top 100
    filteredResults.sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0));
    const top100 = filteredResults.slice(0, 100);

    // 5. Process monthly search data
    const MONTH_NAMES = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const processedKeywords = top100.map((result) => {
      const monthYears: string[] = [];
      const monthlySearchVolumes: number[] = [];

      if (result.monthly_searches && result.monthly_searches.length > 0) {
        for (const entry of result.monthly_searches) {
          const monthName = MONTH_NAMES[entry.month] || "";
          monthYears.push(`${monthName} ${entry.year}`);
          monthlySearchVolumes.push(entry.search_volume || 0);
        }
      }

      return {
        keyword: result.keyword || "",
        searchVolume: result.search_volume || 0,
        cpc: result.cpc || 0,
        competition: result.competition || 0,
        competitionIndex: result.competition_index || 0,
        lowTopOfPageBid: result.low_top_of_page_bid || 0,
        highTopOfPageBid: result.high_top_of_page_bid || 0,
        monthlySearches: result.monthly_searches || [],
        monthYears,
        monthlySearchVolumes,
        keywordAnnotations: result.keyword_annotations || {},
      };
    });

    return sendSuccessUnencrypted(
      res,
      {
        generatedKeywords,
        totalTokens,
        keywords: processedKeywords,
        totalKeywords: processedKeywords.length,
        metadata: {
          niche,
          subNiche: subNiche || null,
          businessModel: businessModel || "No Business Model",
          languageCode: googleLanguageCode,
          locationCode: googleLocationCode,
          languageName: googleLanguageName,
        },
      },
      "Opportunities found successfully"
    );
  } catch (error: any) {
    logger.error("Opportunity Finder Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to find opportunities");
  }
};

/**
 * Opportunity Finder - Generate and analyze keywords
 * POST /api/seo/opportunity-finder
 */
export const findOpportunitiesSV = async (req: Request, res: Response) => {
  try {
    const {
      niche,
      subNiche,
      businessModel,
      googleLanguageCode,
      googleLocationCode,
      googleLanguageName,
    } = req.body;

    // if (!niche || !googleLanguageCode || !googleLocationCode || !googleLanguageName) {
    //   return sendError(
    //     res,
    //     400,
    //     "Missing required fields: niche, googleLanguageCode, googleLocationCode, googleLanguageName"
    //   );
    // }

    // 1. Generate keywords using OpenAI
    let generatedKeywords = "";
    let totalTokens = 0;

    try {
      const openAiResponse = await openAiService.generateKeywords({
        niche,
        subNiche: subNiche || undefined,
        businessModel: businessModel || "No Business Model",
        languageName: googleLanguageName,
        languageCode: googleLanguageCode,
      });

      generatedKeywords = openAiResponse?.choices?.[0]?.message?.content || "";
      totalTokens = openAiResponse?.usage?.total_tokens || 0;
    } catch (error: any) {
      logger.error("OpenAI Keyword Generation Error", {
        error: error.message,
      });
      return sendError(res, 500, `Failed to generate keywords: ${error.message}`);
    }

    if (!generatedKeywords) {
      return sendError(res, 500, "No keywords generated");
    }

    // 2. Split and format keywords
    const keywords = generatedKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      return sendError(res, 500, "No valid keywords found");
    }

    // 3. Get keyword metrics from DataForSEO
    let keywordMetrics = null;
    try {
      // keywordMetrics = await dataForSeoService.getKeywordsForKeywords({
      keywordMetrics = await dataForSeoService.getSearchVolumeForKeywords({
        keywords,
        location_code: googleLocationCode,
        language_code: googleLanguageCode,
        sort_by: "search_volume",
      });
    } catch (error: any) {
      logger.error("DataForSEO Keywords API Error", {
        error: error.message,
      });
      return sendError(res, 500, `Failed to get keyword metrics: ${error.message}`);
    }

    // 4. Process and filter results
    let allResults: any[] = [];
    allResults = keywordMetrics?.tasks?.[0]?.result;

    // Sort by search volume and take top 100
    allResults.sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0));
    const top100 = allResults.slice(0, 100);

    // 5. Process monthly search data
    const MONTH_NAMES = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const processedKeywords = top100.map((result) => {
      const monthYears: string[] = [];
      const monthlySearchVolumes: number[] = [];

      if (result.monthly_searches && result.monthly_searches.length > 0) {
        for (const entry of result.monthly_searches) {
          const monthName = MONTH_NAMES[entry.month] || "";
          monthYears.push(`${monthName} ${entry.year}`);
          monthlySearchVolumes.push(entry.search_volume || 0);
        }
      }

      return {
        keyword: result.keyword || "",
        searchVolume: result.search_volume || 0,
        cpc: result.cpc || 0,
        competition: result.competition || 0,
        competitionIndex: result.competition_index || 0,
        lowTopOfPageBid: result.low_top_of_page_bid || 0,
        highTopOfPageBid: result.high_top_of_page_bid || 0,
        monthlySearches: result.monthly_searches || [],
        monthYears,
        monthlySearchVolumes,
        keywordAnnotations: result.keyword_annotations || {},
      };
    });

    return sendSuccessUnencrypted(
      res,
      {
        generatedKeywords,
        totalTokens,
        keywords: processedKeywords,
        totalKeywords: processedKeywords.length,
        metadata: {
          niche,
          subNiche: subNiche || null,
          businessModel: businessModel || "No Business Model",
          languageCode: googleLanguageCode,
          locationCode: googleLocationCode,
          languageName: googleLanguageName,
        },
      },
      "Opportunities found successfully"
    );
  } catch (error: any) {
    logger.error("Opportunity Finder Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to find opportunities");
  }
};

/**
 * Opportunity Finder (Labs) - Generate & analyze keyword opportunities
 * POST /api/seo/opportunity-finder-lab
 */
export const findOpportunitiesLab = async (req: Request, res: Response) => {
  try {
    const { niche, googleLocationCode, googleLanguageName, limit } = req.body;
    if (!niche) return sendError(res, 400, "Missing required fields: keyword");

    // 1. Fetch keyword suggestions
    let suggestionsResponse;
    try {
      suggestionsResponse = await dataForSeoService.getKeywordSuggestions({
        keyword: niche,
        location_code: googleLocationCode,
        language_name: googleLanguageName,
        include_serp_info: true,
        include_seed_keyword: true,
        limit: limit ?? 10,
      });
    } catch (error: any) {
      logger.error("DataForSEO Labs Keyword Suggestions Error", { error: error.message });
      return sendError(res, 500, `Failed to get keyword suggestions: ${error.message}`);
    }

    // 2. Extract all items
    let allResults: any[] = [];
    const tasks = suggestionsResponse.tasks?.[0] || [];
    allResults = tasks?.result?.[0]?.items || [];
    // Filter items with keyword_info
    const validResults = allResults.filter((item) => item.keyword_info != null);
    if (validResults.length === 0) return sendError(res, 404, "No keyword opportunities found");

    // 3. Sort by search volume and take top 100
    const top100 = validResults
      .sort((a, b) => (b.keyword_info.search_volume || 0) - (a.keyword_info.search_volume || 0))
      .slice(0, 100);

    // 4. Process monthly search data
    const MONTH_NAMES = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const processedKeywords = top100.map((item) => {
      const monthlySearches = item.keyword_info?.monthly_searches || [];
      const monthYears: string[] = [];
      const monthlySearchVolumes: number[] = [];

      for (const entry of monthlySearches) {
        monthYears.push(`${MONTH_NAMES[entry.month]} ${entry.year}`);
        monthlySearchVolumes.push(entry.search_volume || 0);
      }

      return {
        keyword: item.keyword,
        searchVolume: item.keyword_info?.search_volume || 0,
        cpc: item.keyword_info?.cpc || 0,
        competition: item.keyword_info?.competition || 0,
        lowTopOfPageBid: item.keyword_info?.low_top_of_page_bid || 0,
        highTopOfPageBid: item.keyword_info?.high_top_of_page_bid || 0,
        monthlySearches,
        monthYears,
        monthlySearchVolumes,
        keywordProperties: item.keyword_properties || {},
      };
    });

    return sendSuccessUnencrypted(
      res,
      {
        seedKeyword: niche,
        keywords: processedKeywords,
        totalKeywords: processedKeywords.length,
        metadata: { locationCode: googleLocationCode, languageName: googleLanguageName },
      },
      "Keyword opportunities found successfully"
    );
  } catch (error: any) {
    logger.error("Opportunity Finder Lab Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to find opportunities");
  }
};

/**
 * Domain Metrics 2 - Top Content and Competitors
 * POST /api/seo/domain-metrics-advanced
 */
export const getDomainMetricsAdvanced = async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return sendError(res, 400, "Domain is required");
    }

    // Format domain (remove protocol, www, trailing slash)
    const formattedDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
      .trim();

    // 1. Get top content pages (domain pages summary)
    let topContent = null;
    let topContentCost = 0;
    try {
      const topContentResult = await dataForSeoService.getDomainPagesSummary({
        target: formattedDomain,
        order_by: [
          {
            fieldName: "referring_domains",
            direction: "desc",
          },
        ],
        limit: 25,
      });

      topContent = topContentResult?.tasks?.[0]?.result?.[0]?.items || [];
      topContentCost = topContentResult?.tasks?.[0]?.cost || 0;
    } catch (error: any) {
      logger.warn("Failed to get top content", { error: error.message });
    }

    // 2. Get competitors
    let competitors = null;
    let competitorsCost = 0;
    try {
      const competitorsResult = await dataForSeoService.getCompetitors({
        target: formattedDomain,
        limit: 25,
      });

      competitors = competitorsResult?.tasks?.[0]?.result?.[0]?.items || [];
      competitorsCost = competitorsResult?.tasks?.[0]?.cost || 0;
    } catch (error: any) {
      logger.warn("Failed to get competitors", { error: error.message });
    }

    // Process top content data
    const processedTopContent =
      topContent?.map((item: any) => ({
        url: item.url || "",
        referringDomains: item.referring_domains || 0,
        backlinks: item.backlinks || 0,
        rank: item.rank || 0,
        domainRank: item.domain_rank || 0,
        lastSeen: item.last_seen || "",
        firstSeen: item.first_seen || "",
      })) || [];

    // Process competitors data
    const processedCompetitors =
      competitors?.map((item: any) => ({
        target: item.target || "",
        rank: item.rank || 0,
        intersections: item.intersections || 0,
        referringDomains: item.referring_domains || 0,
        backlinks: item.backlinks || 0,
      })) || [];

    const totalCost = topContentCost + competitorsCost;

    return sendSuccessUnencrypted(
      res,
      {
        domain: formattedDomain,
        topContent: {
          items: processedTopContent,
          totalCount: topContent?.length || 0,
          cost: topContentCost,
        },
        competitors: {
          items: processedCompetitors,
          totalCount: competitors?.length || 0,
          cost: competitorsCost,
        },
        totalCost,
      },
      "Domain metrics advanced data retrieved successfully"
    );
  } catch (error: any) {
    logger.error("Domain Metrics Advanced Error", { error: error.message });
    return sendError(res, 500, error.message || "Failed to retrieve domain metrics advanced data");
  }
};
