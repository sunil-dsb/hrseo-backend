import { type Request, type Response } from "express";
import { sendError, sendSuccess } from "@/utils/response";
import { hashPassword, verifyPassword } from "@/utils/passwordUtils";
import {
  extractIpAddress,
  extractUserAgent,
  parseTimeString,
} from "@/utils/helperFunctions";
import { createToken } from "@/utils/tokenUtils";
import { v4 as uuidv4 } from "uuid";
import { prismaClient } from "@/lib/prismaClient";
import { encryptData } from "@/utils/encryptDecryptPayload";
import type {
  UserGetPayload,
  UserSelect,
} from "prisma/generated/prisma/models";

const userSelect = {
  id: true,
  email: true,
  emailVerified: true,
  name: true,
  avatarUrl: true,
  status: true,
  accounts: {
    where: {
      provider: "EMAIL",
    },
  },
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
} satisfies UserSelect;

export type CheckUserType = UserGetPayload<{
  select: typeof userSelect;
}>;

const checkUser = async (req: Request) => {
  const userId = req?.userId;
  if (!userId) {
    return { success: false, code: 401, error: "Unauthorized request" };
  }

  const checkUser = await prismaClient?.user?.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      avatarUrl: true,
      status: true,
      accounts: {
        where: {
          provider: "EMAIL",
        },
      },
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
  if (!checkUser) {
    return { success: false, code: 404, error: "User not found" };
  }
  if (checkUser?.status === "SUSPENDED") {
    return {
      success: false,
      code: 403,
      error:
        "This account is suspended. Please check your email or contact support for more information.",
    };
  }
  if (checkUser?.status === "DELETED") {
    return {
      success: false,
      code: 403,
      error:
        "This account is deleted. Please contact support for more information.",
    };
  }

  return { success: true, code: 200, data: checkUser };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, name, avatarUrl, password } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 404, "Name, email and password are required");
    }

    const hashedPassword = await hashPassword(password);
    if (!hashedPassword) {
      return sendError(res, 409, "Failed to hash the password");
    }

    const checkUser = await prismaClient.user.findFirst({
      where: {
        email,
      },
    });
    if (checkUser) {
      return sendError(res, 409, "User already exist");
    }

    const role = await prismaClient?.role?.findFirst({
      where: {
        name: "user",
      },
    });
    if (!role) {
      return sendError(res, 404, "Role not found");
    }

    const uniqueUserId = uuidv4();
    const response = await prismaClient?.user?.create({
      data: {
        id: uniqueUserId,
        email,
        name,
        avatarUrl,
        roleId: role?.id,

        accounts: {
          create: {
            provider: "EMAIL",
            passwordHash: hashedPassword,
          },
        },
      },
    });

    if (!response) {
      return sendError(res, 400, "ERROR while registering new user");
    }

    return sendSuccess(res, null, "Registered successfully");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, "Email and password are required");
    }

    const checkUser = await prismaClient?.user?.findFirst({
      where: {
        email,
      },
      select: userSelect,
    });

    if (!checkUser) {
      return sendError(res, 404, "Email address not found");
    }

    if (checkUser?.status === "SUSPENDED") {
      return sendError(
        res,
        403,
        "This account is suspended. Please check your email or contact support for more information."
      );
    }
    if (checkUser?.status === "DELETED") {
      return {
        success: false,
        code: 403,
        error:
          "This account is deleted. Please contact support for more information.",
      };
    }

    const checkPassword = verifyPassword(
      checkUser?.accounts?.[0]?.passwordHash || "",
      password
    );
    if (!checkPassword) {
      return sendError(res, 401, "Invalid password");
    }

    const payload = {
      userId: checkUser?.id,
      email: checkUser?.email,
    };
    const access_token = await createToken(payload, "access_token");
    const refresh_token = await createToken(payload, "refresh_token");

    if (!access_token?.success || !refresh_token?.success) {
      return sendError(res, 401, "Error while creating tokens");
    }

    const accessExpiryMs = parseTimeString(
      process.env.ACCESS_TOKEN_EXPIRY || "1h"
    );
    const refreshExpiryMs = parseTimeString(
      process.env.REFRESH_TOKEN_EXPIRY || "30d"
    );

    const refreshTokenExpiry = new Date(Date.now() + refreshExpiryMs);

    await prismaClient?.session?.create({
      data: {
        userId: checkUser?.id,
        token: refresh_token?.data || "",
        expiresAt: refreshTokenExpiry,
      },
    });

    const encryptedUserData = await encryptData(checkUser);
    res.cookie("access_token", access_token?.data, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: accessExpiryMs,
      path: "/",
    });
    res.cookie("refresh_token", refresh_token?.data, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: refreshExpiryMs,
      path: "/",
    });
    res.cookie("user_data", encryptedUserData, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: refreshExpiryMs,
      path: "/",
    });

    const responsePayload = {
      userId: checkUser?.id,
      name: checkUser?.name || "",
      email: checkUser?.email,
      avatarUrl: checkUser?.avatarUrl,
      access_token: access_token?.data,
    };

    return sendSuccess(res, responsePayload, "Successfully logged in");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { success: checkUserSuccess, error: checkUserError } =
      await checkUser(req);
    if (!checkUserSuccess) {
      return sendError(res, 400, checkUserError || "Unknown error");
    }

    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return sendError(res, 401, "Unauthorized");
    }

    await prismaClient?.session?.deleteMany({
      where: {
        token: refreshToken,
      },
    });

    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
    res.clearCookie("user_data", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });

    return sendSuccess(res, null, "User logged out successfully");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

export const renewToken = async (req: Request, res: Response) => {
  try {
    const {
      success: checkUserSuccess,
      data: checkUserData,
      error: checkUserError,
    } = await checkUser(req);
    if (!checkUserSuccess) {
      return sendError(res, 400, checkUserError || "Unknown error");
    }

    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return sendError(res, 401, "Unauthorized");
    }

    const payload = {
      userId: checkUserData?.id,
      email: checkUserData?.email,
    };
    const access_token = await createToken(payload, "access_token");
    const refresh_token = await createToken(payload, "refresh_token");

    if (!access_token?.success || !refresh_token?.success) {
      return sendError(res, 401, "Error while creating tokens");
    }

    const checkSession = await prismaClient?.session?.findFirst({
      where: {
        token: refreshToken,
      },
    });

    if (!checkSession) {
      return sendError(res, 401, "Session not found");
    }

    const accessExpiryMs = parseTimeString(
      process.env.ACCESS_TOKEN_EXPIRY || "1h"
    );
    const refreshExpiryMs = parseTimeString(
      process.env.REFRESH_TOKEN_EXPIRY || "30d"
    );

    const refreshTokenExpiry = new Date(Date.now() + refreshExpiryMs);

    await prismaClient?.session?.update({
      where: {
        id: checkSession?.id,
      },
      data: {
        token: refresh_token.data,
        expiresAt: refreshTokenExpiry,
      },
    });

    const encryptedUserData = await encryptData(checkUserData);
    res.cookie("access_token", access_token?.data, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: accessExpiryMs,
      path: "/",
    });
    res.cookie("refresh_token", refresh_token?.data, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: refreshExpiryMs,
      path: "/",
    });
    res.cookie("user_data", encryptedUserData, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: refreshExpiryMs,
      path: "/",
    });

    return sendSuccess(res, null, "Tokens renewed successfully");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

export const getAllSessions = async (req: Request, res: Response) => {
  try {
    const {
      success: checkUserSuccess,
      data: checkUserData,
      error: checkUserError,
    } = await checkUser(req);
    if (!checkUserSuccess) {
      return sendError(res, 400, checkUserError || "Unknown error");
    }
    const sessions = await prismaClient?.session?.findMany({
      where: {
        userId: checkUserData?.id,
      },
    });

    return sendSuccess(res, sessions, "ok");
  } catch (error) {
    return sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

// export const passwordResetCreate = async (req: Request, res: Response) => {
//   const ipAddress = extractIpAddress(req);
//   const userAgent = extractUserAgent(req);
//   try {
//     const {
//       success: checkUserSuccess,
//       data: checkUserData,
//       error: checkUserError,
//     } = await checkUser(req);
//     if (!checkUserSuccess) {
//       return sendError(res, 400, checkUserError || "Unknown error");
//     }

//     await prismaClient?.passwordReset?.updateMany({
//       where: {
//         userId: checkUserData?.id,
//         isActive: true,
//       },
//       data: {
//         isActive: false,
//       },
//     });

//     const payload = {
//       userId: checkUserData?.id,
//       email: checkUserData?.email,
//       role: checkUserData?.userDetail?.role?.name,
//     };
//     const password_reset_token = await createToken(payload, "password_reset");

//     const passwordResetUrl = `${process.env.CORS_ORIGIN}/auth/password-reset?id=${password_reset_token?.data}`;

//     const passwordResetExpiryMs = parseTimeString(
//       process.env.PASSWORD_RESET_TOKEN_EXPIRY || "1h"
//     );

//     const accessTokenExpiry = new Date(Date.now() + passwordResetExpiryMs);

//     await prismaClient?.passwordReset?.create({
//       data: {
//         password_reset_token: password_reset_token?.data || "",
//         userId: checkUserData?.id || "",
//         expireAt: accessTokenExpiry,
//         isActive: true,
//       },
//     });

//     const auditLogPayloadSuccess: AuditLogPayload = {
//       actorId: req?.userId || "",
//       actorRole: req?.role as string,
//       module: "auth",
//       action: "passwordResetCreate",
//       targetId: req?.userId || "",
//       result: "success",
//       ip: ipAddress || "",
//       ua: userAgent || "",
//     };
//     return sendSuccess(
//       res,
//       passwordResetUrl,
//       "Password reset url created",
//       auditLogPayloadSuccess
//     );
//   } catch (error) {
//     const auditLogPayloadFail: AuditLogPayload = {
//       actorId: req?.userId || "",
//       actorRole: req?.role as string,
//       module: "auth",
//       action: "passwordResetCreate",
//       targetId: req?.userId || "",
//       result: "fail",
//       reason: error instanceof Error ? error.message : "Unknown error",
//       ip: ipAddress || "",
//       ua: userAgent || "",
//     };
//     return sendError(
//       res,
//       400,
//       error instanceof Error ? error.message : "Unknown error",
//       auditLogPayloadFail
//     );
//   }
// };

// export const passwordResetVerify = async (req: Request, res: Response) => {
//   const ipAddress = extractIpAddress(req);
//   const userAgent = extractUserAgent(req);
//   try {
//     const { token, password, confirm_password } = req.body;
//     if (!token || !password || !confirm_password) {
//       return sendError(
//         res,
//         404,
//         "Token, password and confirm_password are required"
//       );
//     }

//     if (password !== confirm_password) {
//       const auditLogPayloadFail: AuditLogPayload = {
//         actorId: req?.userId || "",
//         actorRole: req?.role as string,
//         module: "auth",
//         action: "passwordResetVerify",
//         targetId: req?.userId || "",
//         result: "fail",
//         reason: "Confirm password is invalid.",
//         ip: ipAddress || "",
//         ua: userAgent || "",
//       };
//       return sendError(
//         res,
//         400,
//         "Confirm password is invalid.",
//         auditLogPayloadFail
//       );
//     }

//     const checkId = await prismaClient?.passwordReset?.findFirst({
//       where: {
//         password_reset_token: token,
//         isActive: true,
//       },
//     });
//     if (!checkId) {
//       const auditLogPayloadFail: AuditLogPayload = {
//         actorId: req?.userId || "",
//         actorRole: req?.role as string,
//         module: "auth",
//         action: "passwordResetVerify",
//         targetId: req?.userId || "",
//         result: "fail",
//         reason: "Password reset request not found",
//         ip: ipAddress || "",
//         ua: userAgent || "",
//       };
//       return sendError(
//         res,
//         404,
//         "Password reset request not found",
//         auditLogPayloadFail
//       );
//     }

//     const hashedPassword = await hashPassword(password);

//     await prismaClient?.user?.update({
//       where: {
//         id: checkId?.userId,
//       },
//       data: {
//         password: hashedPassword,
//       },
//     });

//     await prismaClient?.passwordReset?.update({
//       where: {
//         id: checkId?.id,
//       },
//       data: {
//         isActive: false,
//       },
//     });

//     const auditLogPayloadSuccess: AuditLogPayload = {
//       actorId: req?.userId || "",
//       actorRole: req?.role as string,
//       module: "auth",
//       action: "passwordResetVerify",
//       targetId: req?.userId || "",
//       result: "success",
//       ip: ipAddress || "",
//       ua: userAgent || "",
//     };
//     return sendSuccess(
//       res,
//       null,
//       "Password reset successfully",
//       auditLogPayloadSuccess
//     );
//   } catch (error) {
//     const auditLogPayloadFail: AuditLogPayload = {
//       actorId: req?.userId || "",
//       actorRole: req?.role as string,
//       module: "auth",
//       action: "passwordResetVerify",
//       targetId: req?.userId || "",
//       result: "fail",
//       reason: error instanceof Error ? error.message : "Unknown error",
//       ip: ipAddress || "",
//       ua: userAgent || "",
//     };
//     return sendError(
//       res,
//       400,
//       error instanceof Error ? error.message : "Unknown error",
//       auditLogPayloadFail
//     );
//   }
// };
