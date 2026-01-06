import axios, { type AxiosInstance } from "axios";
import { logger } from "@/utils/logger";
import type { SerpApiResponse } from "@/types/dataforseo-types";

interface DataForSeoApiConfig {
  login: string;
  password: string;
}

export class DataForSeoApiService {
  private client: AxiosInstance;
  private authToken: string;

  constructor(config: DataForSeoApiConfig) {
    this.authToken = Buffer.from(`${config.login}:${config.password}`).toString("base64");

    this.client = axios.create({
      baseURL: process.env.DATAFORSEO_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${this.authToken}`,
      },
      timeout: 60000,
    });
  }

  /**
   * Get Google SERP results
   */
  async getGoogleSerp(params: {
    keyword: string;
    location_code: number;
    language_code: string;
    device?: "desktop" | "mobile" | "tablet";
  }): Promise<SerpApiResponse> {
    try {
      const response = await this.client.post("/v3/serp/google/organic/live/regular", [
        {
          keyword: params.keyword,
          location_code: params.location_code,
          language_code: params.language_code,
          device: params.device || "desktop",
        },
      ]);

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO SERP API Error", {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Get backlinks summary
   */
  async getBacklinksSummary(params: {
    target: string;
    rank_scale?: "one_hundred" | "ten";
    backlinks_filters?: string[];
  }) {
    try {
      const response = await this.client.post("/v3/backlinks/summary/live", [
        {
          target: params.target,
          rank_scale: params.rank_scale || "one_hundred",
          backlinks_filters: params.backlinks_filters || [],
        },
      ]);

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO Backlinks Summary API Error", {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Get historical backlinks data
   */
  async getBacklinksHistory(params: {
    target: string;
    date_from: string;
    date_to: string;
    rank_scale?: "one_hundred" | "ten";
  }) {
    try {
      const response = await this.client.post("/v3/backlinks/history/live", [
        {
          target: params.target,
          date_from: params.date_from,
          date_to: params.date_to,
          rank_scale: params.rank_scale || "one_hundred",
        },
      ]);

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO Backlinks History API Error", {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Get anchor text distribution
   */
  async getAnchors(params: { target: string; limit?: number }) {
    try {
      const response = await this.client.post("/v3/backlinks/anchors/live", [
        {
          target: params.target,
          limit: params.limit || 25,
        },
      ]);

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO Anchors API Error", {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Get keywords for keywords (keyword suggestions with metrics)
   */
  async getKeywordsForKeywords(params: {
    keywords: string[];
    location_code: number;
    language_code: string;
    sort_by?:
      | "search_volume"
      | "cpc"
      | "competition"
      | "low_top_of_page_bid"
      | "high_top_of_page_bid";
    include_serp_info?: boolean;
    date_from?: string;
    date_to?: string;
  }) {
    try {
      const response = await this.client.post(
        "/v3/keywords_data/google_ads/keywords_for_keywords/live",
        [
          {
            location_code: params.location_code,
            language_code: params.language_code,
            keywords: params.keywords,
            sort_by: params.sort_by || "search_volume",
            include_serp_info: params.include_serp_info || false,
            date_from: params.date_from,
            date_to: params.date_to,
          },
        ]
      );

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO Keywords for Keywords API Error", {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Get domain pages summary (top content pages)
   * Returns pages from a domain sorted by referring domains
   */
  async getDomainPagesSummary(params: {
    target: string;
    order_by?: Array<{
      fieldName: string;
      direction: "asc" | "desc";
    }>;
    limit?: number;
    offset?: number;
    filters?: Array<any>;
  }) {
    try {
      const requestBody: any = {
        target: params.target,
        limit: params.limit || 25,
      };

      if (params.order_by && params.order_by.length > 0) {
        requestBody.order_by = params.order_by;
      }

      if (params.offset !== undefined) {
        requestBody.offset = params.offset;
      }

      if (params.filters && params.filters.length > 0) {
        requestBody.filters = params.filters;
      }

      const response = await this.client.post("/v3/backlinks/domain_pages_summary/live", [
        requestBody,
      ]);

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO Domain Pages Summary API Error", {
        error: error.message,
        params,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get competitors (domains that compete for the same backlinks)
   * Returns domains that share backlinks with the target domain
   */
  async getCompetitors(params: {
    target: string;
    limit?: number;
    offset?: number;
    filters?: Array<any>;
  }) {
    try {
      const requestBody: any = {
        target: params.target,
        limit: params.limit || 25,
      };

      if (params.offset !== undefined) {
        requestBody.offset = params.offset;
      }

      if (params.filters && params.filters.length > 0) {
        requestBody.filters = params.filters;
      }

      const response = await this.client.post("/v3/backlinks/competitors/live", [requestBody]);

      return response.data;
    } catch (error: any) {
      logger.error("DataForSEO Competitors API Error", {
        error: error.message,
        params,
        response: error.response?.data,
      });
      throw error;
    }
  }
}

// Export singleton instance factory
export const createDataForSeoApiService = (config: DataForSeoApiConfig) => {
  return new DataForSeoApiService(config);
};
