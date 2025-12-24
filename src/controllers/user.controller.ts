import { type Request, type Response } from "express";
import { prismaClient } from "@/lib/prismaClient";
import { sendError, sendSuccess } from "@/utils/response";

export const getUserData = async (req: Request, res: Response) => {
  try {
    const userId = req?.userId;
    if (!userId) {
      return { success: false, code: 401, error: "Unauthorized request" };
    }
    const response = await prismaClient?.user?.findFirst({
      where: {
        id: userId,
      },
    });
    if (!response) {
      return sendError(res, 404, "User not found");
    }
    return sendSuccess(res, response, "ok");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};
