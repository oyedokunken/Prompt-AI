import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { generalLimiter } from "./middleware/rateLimit";
import { prisma } from "./lib/prisma";

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} is not allowed`));
      }
    },
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

// ---------------------------------------------------------------------------
// Global rate limit (applied before route-level limits)
// ---------------------------------------------------------------------------
app.use(generalLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use("/auth", authRouter);

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found." });
});

// ---------------------------------------------------------------------------
// Startup (local dev only — Vercel handles the listener in serverless mode)
// ---------------------------------------------------------------------------
async function start(): Promise<void> {
  app.listen(env.PORT, () => {
    console.log(`[api] running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  process.on("SIGTERM", async () => {
    console.log("[api] SIGTERM received, shutting down");
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Export for Vercel serverless
export default app;

// Start listener only when running locally (not on Vercel)
if (!process.env.VERCEL) {
  start().catch((err) => {
    console.error("[api] failed to start:", err);
    process.exit(1);
  });
}
