import { Router, type Request, type Response, type NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HoldingsRepository } from "../repositories/holdings.js";
import { HoldingsService, HoldingsServiceError } from "../services/holdings.js";
import { createHoldingsCsvTemplate, CSV_MAX_BYTES } from "../imports/holdings-csv.js";

function sendError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof HoldingsServiceError) {
    response.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}) });
  } else next(error);
}

function getService(request: Request): HoldingsService {
  if (!request.user || !request.supabase) throw new HoldingsServiceError(401, "Unauthorized");
  const secret = process.env["HOLDINGS_IMPORT_SECRET"] ?? "";
  return new HoldingsService(new HoldingsRepository(request.supabase as SupabaseClient, request.user.id), request.user.id, secret);
}

function csvBody(request: Request): string {
  if (typeof request.body !== "string") throw new HoldingsServiceError(400, "Expected a text/csv request body");
  if (Buffer.byteLength(request.body, "utf8") > CSV_MAX_BYTES) throw new HoldingsServiceError(413, "CSV exceeds the 1 MiB file size limit");
  return request.body;
}

export function createHoldingsRouter(): Router {
  const router = Router();
  router.get("/holdings", async (request, response, next) => { try { response.json(await getService(request).list()); } catch (error) { sendError(error, response, next); } });
  router.post("/holdings", async (request, response, next) => { try { response.status(201).json(await getService(request).create(request.body)); } catch (error) { sendError(error, response, next); } });
  router.patch("/holdings/:ticker", async (request, response, next) => { try { response.json(await getService(request).update(request.params["ticker"] ?? "", request.body)); } catch (error) { sendError(error, response, next); } });
  router.delete("/holdings/:ticker", async (request, response, next) => { try { response.json(await getService(request).delete(request.params["ticker"] ?? "")); } catch (error) { sendError(error, response, next); } });
  router.post("/holdings/import/preview", async (request, response, next) => { try { response.json(await getService(request).previewCsv(csvBody(request))); } catch (error) { sendError(error, response, next); } });
  router.post("/holdings/import/confirm", async (request, response, next) => {
    try { response.json(await getService(request).confirmCsv(csvBody(request), request.get("x-import-preview-token") ?? "")); } catch (error) { sendError(error, response, next); }
  });
  router.get("/holdings/import/template", (_request, response) => { response.type("text/csv").attachment("holdings-template.csv").send(createHoldingsCsvTemplate()); });
  return router;
}
