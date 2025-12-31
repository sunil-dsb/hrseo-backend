import { getAllPlans, getSinglePlan } from "@/controllers/plan.controller";
import { checkAuthentication } from "@/middlewares/checkAuthentication";
import { checkAuthorization } from "@/middlewares/checkAuthorization";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/get-all-plans",
  // checkAuthentication,
  // checkAuthorization({ module: "Billing", action: "canReadList" }),
  getAllPlans
);

router.get("/get-single-plan/:planId", getSinglePlan);

export default router;
