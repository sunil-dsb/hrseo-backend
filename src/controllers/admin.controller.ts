import { type Request, type Response } from "express";
import { prismaClient } from "@/lib/prismaClient";
import { sendError, sendSuccess } from "@/utils/response";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const allUsers = await prismaClient?.user?.findMany();

    return sendSuccess(res, allUsers, "ok");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};
