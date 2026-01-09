import axios, { type AxiosInstance } from "axios";
import { logger } from "@/utils/logger";

interface OpenAiApiConfig {
  apiKey: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export class OpenAiApiService {
  private client: AxiosInstance;

  constructor(config: OpenAiApiConfig) {
    this.client = axios.create({
      baseURL: "https://api.openai.com/v1",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      timeout: 60000,
    });
  }

  /**
   * Generate chat completion (for keyword generation)
   */
  async createChatCompletion(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
  }) {
    try {
      const request: ChatCompletionRequest = {
        model: params.model,
        messages: params.messages,
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens,
      };

      const response = await this.client.post("/chat/completions", request);

      return response.data;
    } catch (error: any) {
      logger.error("OpenAI API Error", {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Generate keywords based on niche and business model
   */
  async generateKeywords(params: {
    niche: string;
    subNiche?: string;
    businessModel: string;
    languageName: string;
    languageCode: string;
  }) {
    const systemPrompt = `Generate 10 seed keywords in ${params.languageName} for the following topic:

Business Context: You are helping someone who works in ${params.businessModel} discover profitable niche opportunities related to ${params.niche}${params.subNiche ? ` and ${params.subNiche}` : ""}.

Conditions:
• Each seed must be neutral and concise (1–3 words).
• Do NOT include search intent modifiers ("how to", "best", "buy", "free", "review", etc.).
• Keywords must not describe the business model itself but reflect real opportunities in this field (products, tools, services, or trends).
• Avoid repeating the same root word more than twice.
• class it by order of relevance, more relevant first.
• Return only a plain list in UTF-8 formatting, no numbering or explanations, split each keyword by a comma(,)

Generate exactly 10 high-value consumer seed keywords.
NICHE: ${params.niche}
${params.subNiche ? `SUB-NICHE: ${params.subNiche}` : ""}
LANGUAGE: ${params.languageName}
BUSINESS MODEL: ${params.businessModel} (never reveal or mention this field anywhere)

${!params.subNiche || params.subNiche === "none" || params.subNiche.trim() === "" ? 'IF SUB-NICHE is empty, blank, "none", or not provided → completely ignore it and generate seeds exclusively for the NICHE as the target niche.' : ""}

CRITICAL CONSUMER FOCUS: Keywords must be exactly what everyday end consumers type when they have a problem or desire in this niche.

INTERNAL ADAPTATION RULE (never mention the business model or this rule in output):
• corporate website → professional, institutional, credible terms that companies search
• affiliate marketing → high-conversion product/category terms perfect for reviews/comparisons
• infopreneur → specific, concrete problems or desired transformations that make people ready to pay for a course/coaching/ebook – NEVER vague emotional states alone (forbidden: "confiance", "stress", "motivation" – allowed only with concrete context: "parler en public", "syndrome imposteur", "gérer le rejet")
• ecommerce → exact product types or category names perfect as H1 on PLP/collection pages
• ads website → highest possible search volume terms (even slightly broader) to maximize Adsense RPM and traffic
• website with subscription → recurring problems or aspirations that justify paying monthly/yearly

Rules – absolute zero tolerance:
• 1–3 words maximum
• Only real terms consumers actually search today in the target language
• NO search-intent modifiers whatsoever (how, best, top, buy, price, review, near me, cheap, free, vs, guide, tutorial, etc.)
• Forbidden generic words unless part of a real consumer term: software, app, tool, platform, service, solution, system, product, strategy, management, marketing, consulting, training, formation
• Ingredients/technical names: FORBIDDEN if only known by professionals. ALLOWED only if everyday consumers in ${params.languageName} genuinely search them to buy a finished product
• Never repeat the exact same root unless variants have clearly different volume/intent
• Do not invent terms
• Prioritize the highest real monetization potential for the selected business model
• The first 5 MUST be the absolute biggest money keywords for this business model
• Every keyword must be 100% usable as-is in DataForSEO, Ahrefs, Semrush, Moz or Google Keyword Planner
• If you cannot find 10 perfect keywords, return fewer than 10 rather than lowering quality
• In any case do not return more then 10 keywords

Output format – exactly this, nothing else:
keyword1, keyword2, keyword3, keyword4, keyword5, keyword6, keyword7, keyword8, keyword9, keyword10`;

    try {
      const response = await this.createChatCompletion({
        model: "gpt-4o-mini", // Using gpt-4o-mini as gpt-5-mini doesn't exist
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
        temperature: 0.7,
      });

      return response;
    } catch (error: any) {
      logger.error("OpenAI Keyword Generation Error", {
        error: error.message,
        params,
      });
      throw error;
    }
  }
}

// Export singleton instance factory
export const createOpenAiApiService = (config: OpenAiApiConfig) => {
  return new OpenAiApiService(config);
};
