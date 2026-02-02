import type { CheckUserType } from "@/controllers/auth.controller";
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

      // Admin bypass - admins have full access
      if (userDataDecrypted?.role?.name === "admin") {
        return next();
      }

      // Check permissions from the cached user data (no database call needed)
      const permissions = userDataDecrypted?.role?.permissions;

      if (!permissions || permissions.length === 0) {
        return sendError(res, 403, "Not Authorized");
      }

      // Check if user has the required permission for the specified module and action
      const hasPermission = permissions.some(
        (permission) => permission.module?.name === module && permission[action] === true
      );

      if (hasPermission) {
        return next();
      } else {
        return sendError(res, 403, "Not Authorized");
      }
    } catch (error) {
      return sendError(res, 401, "Unauthorized");
    }
  };
