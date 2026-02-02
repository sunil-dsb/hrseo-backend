import { type Request, type Response } from "express";
import { prismaClient } from "@/lib/prismaClient";
import { sendError, sendSuccess } from "@/utils/response";

export const getSession = async (req: Request, res: Response) => {
  try {
    const userId = req?.userId;
    if (!userId) {
      return sendError(res, 401, "Unauthorized request");
    }

    const userData = await prismaClient?.user?.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
        role: {
          select: {
            name: true,
            permissions: {
              select: {
                canReadList: true,
                canReadSingle: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
                module: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userData) {
      return sendError(res, 404, "User not found");
    }
    return sendSuccess(res, userData, "ok");
  } catch (error) {
    return sendError(res, 400, error instanceof Error ? error.message : "Unknown error");
  }
};
