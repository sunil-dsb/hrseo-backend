export type SerpApiResponse = {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: {
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      se: string;
      se_type: string;
      language_name: string;
      location_name: string;
      keyword: string;
      tag: string;
      device: string;
      os: string;
    };
    result: {
      keyword: string;
      type: string;
      se_domain: string;
      location_code: number;
      language_code: string;
      check_url: string;
      datetime: string;
      spell: string | null;
      refinement_chips: {
        type: "refinement_chips";
        xpath: string;
        items: {
          type: "refinement_chips_element";
          title: string;
          url: string | null;
          domain: string | null;
          options:
            | {
                type: "refinement_chips_option";
                title: string;
                url: string;
                domain: string;
              }[]
            | null;
        }[];
      } | null;
      item_types: string[];
      se_results_count: number;
      pages_count: number;
      items_count: number;
      items: {
        type: string;
        rank_group: number;
        rank_absolute: number;
        page: number;
        domain: string;
        title: string;
        description: string;
        url: string;
        breadcrumb: string | null;
      }[];
    }[];
  }[];
};

export type BacklinksSummaryResponse = {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: {
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      target: string;
      internal_list_limit: number;
      include_subdomains: boolean;
      backlinks_filters: [string, string, boolean];
      backlinks_status_type: string;
    };
    result: {
      target: string;
      first_seen: string;
      lost_date: string | null;
      rank: number;
      backlinks: number;
      backlinks_spam_score: number;
      crawled_pages: number;
      info: {
        server: string;
        cms: string;
        platform_type: string[];
        ip_address: string;
        country: string;
        is_ip: boolean;
        target_spam_score: number;
      };
      internal_links_count: number;
      external_links_count: number;
      broken_backlinks: number;
      broken_pages: number;
      referring_domains: number;
      referring_domains_nofollow: number;
      referring_main_domains: number;
      referring_main_domains_nofollow: number;
      referring_ips: number;
      referring_subnets: number;
      referring_pages: number;
      referring_pages_nofollow: number;
      referring_links_tld: Record<string, number>;
      referring_links_types: Record<string, number>;
      referring_links_attributes: Record<string, number>;
      referring_links_platform_types: Record<string, number>;
      referring_links_semantic_locations: Record<string, number>;
      referring_links_countries: Record<string, number>;
    }[];
  }[];
};
