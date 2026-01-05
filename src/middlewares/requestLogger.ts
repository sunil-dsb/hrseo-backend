import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../utils/logger";

export interface RequestWithId extends Request {
  id?: string;
  startTime?: number;
}

export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.startTime = Date.now();

  // Log incoming request
  const requestInfo = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("user-agent"),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.method !== "GET" ? sanitizeBody(req.body) : undefined,
  };

  logger.info("Incoming Request", requestInfo);

  // Capture response details
  const originalSend = res.send;
  res.send = function (body) {
    const responseTime = req.startTime ? Date.now() - req.startTime : 0;

    const responseInfo = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get("content-length"),
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error("Request Error", responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn("Request Warning", responseInfo);
    } else {
      logger.info("Request Completed", responseInfo);
    }

    return originalSend.call(this, body);
  };

  next();
};

// Sanitize sensitive data from request body
function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body;
  }

  const sensitiveFields = ["password", "token", "secret", "authorization", "apiKey"];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "***REDACTED***";
    }
  }

  return sanitized;
}
