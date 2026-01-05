import type { CheckUserType } from "@/controllers/auth.controller";
import { prismaClient } from "@/lib/prismaClient";
import { decryptData } from "@/utils/encryptDecryptPayload";
import { sendError } from "@/utils/response";
import { type NextFunction, type Request, type Response } from "express";

export const checkAuthorization =
  ({
    module,
    action,
  }: {
    module: string;
    action: "canReadList" | "canReadSingle" | "canCreate" | "canUpdate" | "canDelete";
  }) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.cookies.user_data;

      if (!userData) {
        return sendError(res, 401, "Unauthorized");
      }

      const userDataDecrypted: CheckUserType = await decryptData(userData);

      if (!userDataDecrypted) {
        return sendError(res, 500, "Decryption failed");
      }

      if (userDataDecrypted?.role?.name === "admin") {
        next();
      } else {
        const checkRole = await prismaClient?.role.findFirst({
          where: {
            name: userDataDecrypted?.role?.name,
          },
          select: {
            permissions: {
              select: {
                id: true,
                roleId: true,
                moduleId: true,
                canReadList: true,
                canReadSingle: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
                module: true,
              },
            },
          },
        });
        if (!checkRole) {
          return sendError(res, 403, "Not Authorized");
        }

        if (
          checkRole?.permissions.some(
            (permission) => permission.module?.name === module && permission[action] === true
          )
        ) {
          next();
        } else {
          return sendError(res, 403, "Not Authorized");
        }
      }
    } catch (error) {
      return sendError(res, 401, "Unauthorized");
    }
  };
