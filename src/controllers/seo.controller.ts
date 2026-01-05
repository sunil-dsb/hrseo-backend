import { type Request, type Response } from "express";
import { sendError, sendSuccessUnencrypted } from "@/utils/response";
import { createMozApiService } from "@/services/mozApi.service";
import { createDataForSeoApiService } from "@/services/dataForSeoApi.service";
import { createOpenAiApiService } from "@/services/openAiApi.service";
import { logger } from "@/utils/logger";

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

    if (!keyword || !locationCodeGoogle || !languageCode) {
      return sendError(
        res,
        400,
        "Missing required fields: keyword, locationCodeGoogle, languageCode"
      );
    }

    // 1. Get SERP results from DataForSEO
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
        // Calculate CF and TF (simplified version - you may want to implement the full algorithm)
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
    let backlinksSummary = null;
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
        distributions: distributions?.distributions || {},
        topReferringDomains:
          topReferringDomains?.result?.linking_domains?.map((domain: any) => ({
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

  const CF_BASE = 14.0;
  const CF_LOG_WEIGHT = 5.0;
  const CF_RD_WEIGHT = 0.8;
  const CF_DEPTH_BOOST = 0.32;

  const externalPages = Math.max(metrics.external_pages_to_page || 0, 1);
  const referringDomains = Math.max(metrics.root_domains_to_page || 0, 1);
  const indirectRefDomains = metrics.indirect_root_domains_to_page || 0;
  const linkPropensity = Math.min(1.0, metrics.link_propensity || 0);

  const rawVolume = externalPages * linkPropensity;
  const depthMultiplier = 1.0 + CF_DEPTH_BOOST * Math.log1p(indirectRefDomains);
  const logVolume = Math.log1p(rawVolume) * depthMultiplier;
  const logVolumeCompressed = Math.log1p(logVolume);

  const cf =
    CF_BASE + CF_LOG_WEIGHT * logVolumeCompressed + CF_RD_WEIGHT * Math.log1p(referringDomains);

  return Math.max(0, Math.min(100, Math.round(cf)));
}

function calculateTF(metrics: any): number {
  if (!metrics) return 0;

  const TF_BASE = 8.5;
  const TF_LOG_SCALING = 6.5;
  const TF_LOG_WEIGHT = 5.78;
  const TF_PA_WEIGHT = 0.065;
  const TF_SPAM_PENALTY_WEIGHT = 0.95;
  const TF_SPAM_EXP = 1.35;

  const pageAuthority = metrics.page_authority || 0;
  const spamScore = (metrics.spam_score || 0) / 100.0;

  const trustSeed = pageAuthority * TF_PA_WEIGHT;
  const spamPenalty = 1.0 - TF_SPAM_PENALTY_WEIGHT * Math.pow(spamScore, TF_SPAM_EXP);

  const tfRaw = TF_BASE + TF_LOG_WEIGHT * Math.log1p(trustSeed * TF_LOG_SCALING);
  const tf = tfRaw * spamPenalty;

  return Math.max(0, Math.min(100, Math.round(tf)));
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

  const scores = competitors.slice(0, 10).map((comp) => {
    const rdFactor = Math.min(50, Math.log1p(comp.rootDomains) * 3);
    return (
      weights.tf * comp.cf +
      weights.da * comp.domainAuthority +
      weights.cf * comp.cf +
      weights.pa * comp.pageAuthority +
      weights.rd_factor * rdFactor
    );
  });

  const avgStrength = scores.reduce((a, b) => a + b, 0) / scores.length;
  const kd = Math.max(0, Math.min(100, Math.round(1.55 * avgStrength - 5)));

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

    if (!niche || !googleLanguageCode || !googleLocationCode || !googleLanguageName) {
      return sendError(
        res,
        400,
        "Missing required fields: niche, googleLanguageCode, googleLocationCode, googleLanguageName"
      );
    }

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
