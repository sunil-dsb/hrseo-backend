import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import routes from "./routes/index";
import { sendSuccess } from "./utils/response";
import { centerlizedErrorHandler } from "./middlewares/centerlizedErrorHandler";
import { requestLogger } from "./middlewares/requestLogger";
import { logger } from "./utils/logger";

const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [];

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn("CORS Error", {
      message: `Origin '${origin}' not allowed`,
      allowedOrigins,
    });
    return callback(new Error(`CORS policy error: Origin '${origin}' not allowed`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
  credentials: true,
};

export const app: Express = express();

// Request logging middleware (should be early in the middleware chain)
app.use(requestLogger);

app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (_, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome to HRSEO Backend API",
    status: "Server is running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      api: "/api",
      auth: "/api/auth",
      user: "/api/user",
      seo: "/api/seo",
    },
  });
});

const apiVersion = "/api/";

app.use(apiVersion, routes);

app.get("/health", (_, res) => {
  return sendSuccess(res, null, "Server is running");
});

app.use(centerlizedErrorHandler);
