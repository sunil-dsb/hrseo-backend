import { type Request, type Response, type NextFunction } from "express";
import { sendError } from "../utils/response";

export function centerlizedErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("🔥 Error:", err);

  const statusCode = err.statusCode || 500;
  const message =
    err.isOperational
      ? err.message
      : "Internal server error";

  return sendError(res, statusCode, message);
}
