import { type Request, type Response } from "express";
import { prismaClient } from "@/lib/prismaClient";
import { sendError, sendSuccess } from "@/utils/response";

export const getUserData = async (req: Request, res: Response) => {
  try {
    const response = await prismaClient?.user?.findFirst({
      where: {
        id: req?.userId,
      },
    });
    if (!response) {
      return sendError(res, 404, "User not found");
    }
    const responseData = {
      ...response,
      createdAt: response?.createdAt?.toISOString(),
      updatedAt: response?.updatedAt?.toISOString(),
    };
    return sendSuccess(res, responseData, "ok");
  } catch (error) {

    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};