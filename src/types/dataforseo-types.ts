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
