type SiteQuery = {
  query: string;
  scope: "url" | "domain" | "subdomain";
  original_site_query: {
    query: string;
    scope: "url" | "domain" | "subdomain";
  };
  site_query_suggestion: string | null;
};

export type SiteMetrics = {
  page: string;
  subdomain: string;
  root_domain: string;
  title: string;
  last_crawled: string;
  http_code: number;
  pages_to_page: number;
  nofollow_pages_to_page: number;
  redirect_pages_to_page: number;
  external_pages_to_page: number;
  external_nofollow_pages_to_page: number;
  external_redirect_pages_to_page: number;
  deleted_pages_to_page: number;
  root_domains_to_page: number;
  indirect_root_domains_to_page: number;
  deleted_root_domains_to_page: number;
  nofollow_root_domains_to_page: number;
  pages_to_subdomain: number;
  nofollow_pages_to_subdomain: number;
  redirect_pages_to_subdomain: number;
  external_pages_to_subdomain: number;
  external_nofollow_pages_to_subdomain: number;
  external_redirect_pages_to_subdomain: number;
  deleted_pages_to_subdomain: number;
  root_domains_to_subdomain: number;
  deleted_root_domains_to_subdomain: number;
  nofollow_root_domains_to_subdomain: number;
  pages_to_root_domain: number;
  nofollow_pages_to_root_domain: number;
  redirect_pages_to_root_domain: number;
  external_pages_to_root_domain: number;
  external_indirect_pages_to_root_domain: number;
  external_nofollow_pages_to_root_domain: number;
  external_redirect_pages_to_root_domain: number;
  deleted_pages_to_root_domain: number;
  root_domains_to_root_domain: number;
  indirect_root_domains_to_root_domain: number;
  deleted_root_domains_to_root_domain: number;
  nofollow_root_domains_to_root_domain: number;
  page_authority: number;
  domain_authority: number;
  link_propensity: number;
  spam_score: number;
  root_domains_from_page: number;
  nofollow_root_domains_from_page: number;
  pages_from_page: number;
  nofollow_pages_from_page: number;
  root_domains_from_root_domain: number;
  nofollow_root_domains_from_root_domain: number;
  pages_from_root_domain: number;
  nofollow_pages_from_root_domain: number;
  pages_crawled_from_root_domain: number;
};

type SiteMetricsResult = {
  site_query: SiteQuery;
  site_metrics: SiteMetrics;
};

export type GetMultipleSiteMetricsResponse = {
  results_by_site: SiteMetricsResult[];
  errors_by_site: any[];
};

// -----------------------------------------------------------------

export interface mozKeyWordDifficultyResponse {
  result: {
    serp_query: {
      keyword: string;
      locale: string;
      device: string;
      engine: string;
      vicinity: string;
    };
    keyword_metrics: {
      volume: null;
      difficulty: 69;
      organic_ctr: null;
      priority: null;
    };
  };
}

export type SiteMetricsDistributionResponse = {
  site_query: {
    query: string;
    scope: "url" | "domain" | "subdomain";
  };
  site_metrics_distributions: {
    root_domains_to_page_by_root_domains: number[];
    root_domains_to_root_domain_by_root_domains: number[];
    nofollow_root_domains_to_root_domain_by_root_domains: number[];
    root_domains_to_page_by_domain_authority: number[];
    root_domains_to_subdomain_by_domain_authority: number[];
    root_domains_to_root_domain_by_domain_authority: number[];
    nofollow_root_domains_to_root_domain_by_domain_authority: number[];
    pages_to_root_domain_by_spam_score: number[];
    nofollow_pages_to_root_domain_by_spam_score: number[];
    root_domains_to_page_by_spam_score: number[];
    root_domains_to_subdomain_by_spam_score: number[];
    root_domains_to_root_domain_by_spam_score: number[];
    nofollow_root_domains_to_root_domain_by_spam_score: number[];
  };
};

export type LinkingDomainsResponse = {
  site_query: {
    query: string;
    scope: "url" | "domain" | "subdomain";
    original_site_query: {
      query: string;
      scope: "url" | "domain" | "subdomain";
    };
    site_query_suggestion: string | null;
  };
  offset: {
    provided_token: string | null;
    token: string;
    limit: number;
  };
  options: {
    sort: string;
    filters: string[];
  };
  linking_domains: {
    site_metrics: SiteMetrics;
    link_propensity: number;
    targeted_pages: number;
    targeted_nofollow_pages: number;
    targeted_redirect_pages: number;
    targeted_deleted_pages: number;
  }[];
};
