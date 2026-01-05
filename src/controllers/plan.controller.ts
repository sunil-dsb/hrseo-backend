import { type Request, type Response } from "express";
import { prismaClient } from "@/lib/prismaClient";
import { sendError, sendSuccess } from "@/utils/response";

export const getAllPlans = async (req: Request, res: Response) => {
  try {
    const plansData = await prismaClient?.plan?.findMany();

    return sendSuccess(res, plansData, "ok");
  } catch (error) {
    return sendError(res, 400, error instanceof Error ? error.message : "Unknown error");
  }
};

export const getSinglePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req?.params;
    if (!planId) {
      return sendError(res, 400, "planId is required");
    }

    const planData = await prismaClient?.plan?.findFirst({
      where: {
        id: planId,
      },
    });

    return sendSuccess(res, planData, "ok");
  } catch (error) {
    return sendError(res, 400, error instanceof Error ? error.message : "Unknown error");
  }
};
