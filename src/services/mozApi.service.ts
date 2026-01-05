import axios, { type AxiosInstance } from "axios";
import { logger } from "@/utils/logger";

interface MozApiConfig {
  accessId?: string;
  secretKey?: string;
  token?: string; // Direct base64 encoded token (alternative to accessId:secretKey)
}

interface MozRequest {
  jsonrpc: string;
  id: string;
  method: string;
  params: Record<string, any>;
}

export class MozApiService {
  private client: AxiosInstance;
  private token: string;

  constructor(config: MozApiConfig) {
    // Support both methods: direct token or accessId:secretKey
    if (config.token) {
      // Use provided token directly
      this.token = config.token;
    } else if (config.accessId && config.secretKey) {
      // Generate token from accessId:secretKey
      this.token = Buffer.from(`${config.accessId}:${config.secretKey}`).toString("base64");
    } else {
      throw new Error("Moz API requires either 'token' or both 'accessId' and 'secretKey'");
    }

    this.client = axios.create({
      baseURL: "https://api.moz.com/jsonrpc",
      headers: {
        "Content-Type": "application/json",
        "x-moz-token": this.token,
      },
      timeout: 30000,
    });
  }

  private async makeRequest(method: string, params: Record<string, any>) {
    try {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const payload: MozRequest = {
        jsonrpc: "2.0",
        id: requestId,
        method,
        params: { data: params },
      };

      const response = await this.client.post("", payload);

      if (response.data.error) {
        logger.error("Moz API Error", {
          method,
          error: response.data.error,
        });
        throw new Error(response.data.error.message || "Moz API request failed");
      }

      return response.data.result;
    } catch (error: any) {
      logger.error("Moz API Request Failed", {
        method,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get keyword difficulty metrics
   */
  async getKeywordDifficulty(params: {
    keyword: string;
    locale: string;
    device?: "desktop" | "mobile";
    engine?: "google" | "bing";
  }) {
    return this.makeRequest("data.keyword.metrics.difficulty.fetch", {
      serp_query: {
        keyword: params.keyword,
        locale: params.locale,
        device: params.device || "desktop",
        engine: params.engine || "google",
      },
    });
  }

  /**
   * Get site metrics for a single site
   */
  async getSiteMetrics(params: { query: string; scope: "url" | "domain" | "subdomain" }) {
    return this.makeRequest("data.site.metrics.fetch", {
      site_query: {
        query: params.query,
        scope: params.scope,
      },
    });
  }

  /**
   * Get site metrics for multiple sites
   */
  async getMultipleSiteMetrics(params: {
    site_queries: Array<{
      query: string;
      scope: "url" | "domain" | "subdomain";
    }>;
  }) {
    return this.makeRequest("data.site.metrics.fetch.multiple", {
      site_queries: params.site_queries,
    });
  }

  /**
   * Get site metrics distributions
   */
  async getSiteMetricsDistributions(params: {
    query: string;
    scope: "url" | "domain" | "subdomain";
  }) {
    return this.makeRequest("data.site.metrics.distributions.fetch", {
      site_query: {
        query: params.query,
        scope: params.scope,
      },
    });
  }

  /**
   * Get backlinks list for a site
   */
  async getBacklinksList(params: {
    query: string;
    scope: "url" | "domain" | "subdomain";
    limit?: number;
    offset?: string;
    sort?: string;
    filters?: string[];
  }) {
    return this.makeRequest("data.site.link.list", {
      site_query: {
        query: params.query,
        scope: params.scope,
      },
      offset: params.offset ? { provided_token: params.offset } : undefined,
      options: {
        limit: params.limit || 25,
        sort: params.sort || "source_page_authority",
        filters: params.filters || ["external"],
      },
    });
  }

  /**
   * Get top referring domains
   */
  async getTopReferringDomains(params: {
    query: string;
    scope: "url" | "domain" | "subdomain";
    limit?: number;
    offset?: string;
  }) {
    return this.makeRequest("data.site.linking-domain.list", {
      site_query: {
        query: params.query,
        scope: params.scope,
      },
      offset: params.offset ? { provided_token: params.offset } : undefined,
      options: {
        limit: params.limit || 25,
      },
    });
  }
}

// Export singleton instance factory
export const createMozApiService = (config: MozApiConfig) => {
  return new MozApiService(config);
};
