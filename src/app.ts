import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import "dotenv/config";
import routes from "./routes/index";
import { sendSuccess } from "./utils/response";
import { centerlizedErrorHandler } from "./middlewares/centerlizedErrorHandler";

const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [];

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS policy error: Origin '${origin}' not allowed`)
    );
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
  credentials: true,
};

export const app: Express = express();

app.use(cors(corsOptions));
app.use(express.json());

const apiVersion = "/api/";

app.use(apiVersion, routes);

app.get("/health", (_, res) => {
  return sendSuccess(res, null, "Server is running");
});

app.use(centerlizedErrorHandler);
