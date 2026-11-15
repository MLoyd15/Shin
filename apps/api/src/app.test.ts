import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Router } from "express";
import { createApp } from "./app.js";

describe("GET /health", () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns an OK status", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("authenticated API routes", () => {
  const calls: Array<{ path: string; authorization: string | null; apiKey: string | null }> = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push({
      path: url.pathname,
      authorization: request.headers.get("authorization"),
      apiKey: request.headers.get("apikey"),
    });

    if (url.pathname === "/auth/v1/user") {
      if (request.headers.get("authorization") === "Bearer network-error-token") {
        throw new TypeError("provider details must not be exposed");
      }
      if (request.headers.get("authorization") !== "Bearer valid-token") {
        return Response.json({ message: "Invalid JWT" }, { status: 401 });
      }

      return Response.json({
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "investor@example.test",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      });
    }

    if (url.pathname === "/rest/v1/holdings") {
      return Response.json([]);
    }

    return Response.json({ message: "Not found" }, { status: 404 });
  };

  const apiRouter = Router();
  apiRouter.get("/holdings", async (request, response, next) => {
    try {
      if (!request.user || !request.supabase) {
        response.sendStatus(500);
        return;
      }

      const { data, error } = await request.supabase.from("holdings").select("ticker");
      if (error) {
        response.sendStatus(500);
        return;
      }

      response.json({ userId: request.user.id, holdings: data });
    } catch (error) {
      next(error);
    }
  });

  const app = createApp({
    apiRouter,
    auth: {
      supabaseUrl: "http://supabase.test",
      supabaseAnonKey: "test-publishable-key",
      fetch: fetchStub,
    },
  });
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("validates the bearer token and scopes database requests to it", async () => {
    const response = await fetch(`${baseUrl}/api/holdings`, {
      headers: { Authorization: "Bearer valid-token" },
    });
    const responseBody = await response.text();

    expect(response.status, responseBody).toBe(200);
    expect(JSON.parse(responseBody)).toEqual({
      userId: "00000000-0000-4000-8000-000000000001",
      holdings: [],
    });
    expect(calls.map((call) => call.path)).toEqual(["/auth/v1/user", "/rest/v1/holdings"]);
    expect(calls.every((call) => call.authorization === "Bearer valid-token")).toBe(true);
    expect(calls.every((call) => call.apiKey === "test-publishable-key")).toBe(true);
  });

  it("rejects requests without a bearer token", async () => {
    const callCount = calls.length;
    const response = await fetch(`${baseUrl}/api/holdings`);

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(callCount);
  });

  it("rejects invalid bearer tokens", async () => {
    const response = await fetch(`${baseUrl}/api/holdings`, {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(401);
    expect(calls.at(-1)?.path).toBe("/auth/v1/user");
  });

  it("returns a generic service error when Auth is unavailable", async () => {
    const response = await fetch(`${baseUrl}/api/holdings`, {
      headers: { Authorization: "Bearer network-error-token" },
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service unavailable",
    });
  });
});
