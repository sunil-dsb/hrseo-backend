import { type Request, type Response, type NextFunction } from "express";
import { sendError } from "../utils/response";
import { logger } from "../utils/logger";
import { type RequestWithId } from "./requestLogger";

export function centerlizedErrorHandler(
  err: any,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  // Log error with request context
  logger.error("Request Error Handler", {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    isOperational: err.isOperational,
  });

  return sendError(res, statusCode, message);
}
