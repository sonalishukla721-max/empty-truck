import pino from "pino";
import { config } from "./index.js";

export const logger = pino({
  level: config.nodeEnv === "production" ? "info" : "debug",
  transport:
    config.nodeEnv === "development"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});
