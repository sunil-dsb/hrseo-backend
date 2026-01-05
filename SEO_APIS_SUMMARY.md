# SEO Tools API Implementation Summary

## APIs Created

Based on your n8n workflows, I've created the following API endpoints:

### 1. SERP Competitors Analysis

**Endpoint:** `POST /api/seo/serp-competitors`

**Request Body:**

```json
{
  "keyword": "gratuit solitaire",
  "locationCodeGoogle": 2250,
  "languageCode": "fr",
  "countryIsoCode": "FR",
  "fallbackLocale": "en-US"
}
```

**Response:** Returns SERP competitors with domain metrics, CF/TF scores, and keyword difficulty.

### 2. Backlinks Checker

**Endpoint:** `POST /api/seo/backlinks`

**Request Body:**

```json
{
  "domain": "https://bubble.io/",
  "limit": 25,
  "offset": "token",
  "sort": "source_page_authority"
}
```

**Response:** Returns list of backlinks with source/target metrics.

### 3. Domain Metrics

**Endpoint:** `POST /api/seo/domain-metrics`

**Request Body:**

```json
{
  "domain": "bubble.io"
}
```

**Response:** Returns comprehensive domain metrics including:

- Site metrics (DA, PA, spam score)
- Top referring domains
- Backlinks summary and history
- Anchor text distribution

### 4. Domain Metrics Advanced (Top Content & Competitors)

**Endpoint:** `POST /api/seo/domain-metrics-advanced`

**Request Body:**

```json
{
  "domain": "stuupid.com"
}
```

**Response:** Returns:

- Top content pages sorted by referring domains
- Competitors (domains sharing backlinks)
- API cost information

### 5. Opportunity Finder

**Endpoint:** `POST /api/seo/opportunity-finder`

**Request Body:**

```json
{
  "niche": "Career & Freelancing",
  "subNiche": "Career Change & Transition",
  "businessModel": "No Business Model",
  "googleLanguageCode": "en",
  "googleLocationCode": 2586,
  "googleLanguageName": "English"
}
```

**Response:** Returns generated keywords with metrics:

- Generated seed keywords from OpenAI
- Keyword metrics (search volume, CPC, competition)
- Monthly search trends
- Top 100 non-brand keywords sorted by volume

---

## Moz APIs Used

The following Moz API methods are implemented:

1. **`data.keyword.metrics.difficulty.fetch`** - Get keyword difficulty
2. **`data.site.metrics.fetch`** - Get single site metrics
3. **`data.site.metrics.fetch.multiple`** - Get multiple site metrics
4. **`data.site.metrics.distributions.fetch`** - Get site metrics distributions
5. **`data.site.link.list`** - Get backlinks list
6. **`data.site.linking-domain.list`** - Get top referring domains

---

## DataForSEO APIs Used

The following DataForSEO API endpoints are implemented:

1. **`/v3/serp/google/organic/live/regular`** - Get Google SERP results
2. **`/v3/backlinks/summary/live`** - Get backlinks summary
3. **`/v3/backlinks/history/live`** - Get historical backlinks data
4. **`/v3/backlinks/anchors/live`** - Get anchor text distribution
5. **`/v3/keywords_data/google_ads/keywords_for_keywords/live`** - Get keyword suggestions with metrics
6. **`/v3/backlinks/domain_pages_summary/live`** - Get top content pages by referring domains
7. **`/v3/backlinks/competitors/live`** - Get competitor domains

---

## OpenAI APIs Used

The following OpenAI API endpoints are implemented:

1. **`/v1/chat/completions`** - Generate keywords using GPT-4o-mini

---

## Required Environment Variables

Add these to your `.env` file:

```env
# Moz API Credentials
# Option 1: Use direct token (recommended - from n8n credentials)
MOZ_TOKEN=bW96c2NhcGUtbEVyOVZYSjFnZzpxNHBickd5WXgzZXdwTUNXd2VRaFJ5Q281bG1McmxENg==

# Option 2: Use accessId and secretKey separately
# MOZ_ACCESS_ID=your_moz_access_id
# MOZ_SECRET_KEY=your_moz_secret_key

# DataForSEO API Credentials
DATAFORSEO_LOGIN=your_dataforseo_login
DATAFORSEO_PASSWORD=your_dataforseo_password

# OpenAI API Credentials
OPENAI_API_KEY=your_openai_api_key
```

---

## Installation

Make sure to install axios (if not already installed):

```bash
pnpm add axios
```

---

## File Structure

```
src/
├── services/
│   ├── mozApi.service.ts          # Moz API service
│   ├── dataForSeoApi.service.ts   # DataForSEO API service
│   └── openAiApi.service.ts      # OpenAI API service
├── controllers/
│   └── seo.controller.ts          # SEO tools controller
└── routes/
    └── seo.route.ts               # SEO routes
```

---

## Authentication

All SEO endpoints require authentication via the `checkAuthentication` middleware.

---

## Notes

- The CF (Citation Flow) and TF (Trust Flow) calculations are simplified versions. You may want to implement the full algorithm from your n8n workflow.
- Error handling is implemented with fallbacks for optional API calls.
- All endpoints return standardized responses using the `sendSuccess`/`sendError` utilities.
- The Opportunity Finder uses GPT-4o-mini (the workflow specified gpt-5-mini which doesn't exist yet).
