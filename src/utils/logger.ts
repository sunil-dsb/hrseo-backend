import winston from "winston";

const logLevel = process.env.LOG_LEVEL || "info";
const nodeEnv = process.env.NODE_ENV || "development";

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [
  // Write all logs to console
  new winston.transports.Console({
    format: nodeEnv === "production" ? logFormat : consoleFormat,
  }),
];

transports.push(
  // Write all logs with level 'error' and below to error.log
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Write all logs to combined.log
  new winston.transports.File({
    filename: "logs/combined.log",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: "hrseo-backend" },
  transports,
});

export default logger;
