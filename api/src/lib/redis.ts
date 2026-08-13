import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[redis] connected");
});
