import cors from "cors";
import express from "express";
import helmet from "helmet";

export function createApp(): express.Express {
  const app = express();
  const allowedOrigin = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: allowedOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  return app;
}
