import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Router } from "express";
import { createAuthMiddleware, type AuthMiddlewareConfig } from "./middleware/require-auth.js";

export interface AppOptions {
  apiRouter?: Router;
  auth?: AuthMiddlewareConfig;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const allowedOrigin = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: allowedOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  if (options.apiRouter) {
    if (!options.auth) {
      throw new Error("Auth configuration is required when mounting API routes");
    }
    app.use("/api", createAuthMiddleware(options.auth), options.apiRouter);
  }

  return app;
}
