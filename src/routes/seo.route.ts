import { Router } from "express";
import {
  getSerpCompetitors,
  getBacklinks,
  getDomainMetrics,
  findOpportunities,
  getDomainMetricsAdvanced,
  findOpportunitiesLab,
  findOpportunitiesSV,
} from "@/controllers/seo.controller";
import { checkAuthentication } from "@/middlewares/checkAuthentication";

const router: Router = Router();

router.use(checkAuthentication);

// SERP Competitors Analysis
router.post("/serp-competitors", getSerpCompetitors);

// Backlinks Checker
router.post("/backlinks", getBacklinks);

// Domain Metrics
router.post("/domain-metrics", getDomainMetrics);

// Domain Metrics Advanced (Top Content & Competitors)
router.post("/domain-metrics-advanced", getDomainMetricsAdvanced);

// Opportunity Finder
router.post("/opportunity-finder", findOpportunities);
router.post("/opportunity-finder-sv", findOpportunitiesSV);
router.post("/opportunity-finder-lab", findOpportunitiesLab);

export default router;
