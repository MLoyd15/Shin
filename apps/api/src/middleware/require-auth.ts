import { createClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";

export interface AuthMiddlewareConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  fetch?: typeof fetch;
}

export function createAuthMiddleware(config: AuthMiddlewareConfig): RequestHandler {
  const fetchImplementation = config.fetch ?? fetch;

  return async (request, response, next) => {
    const authorization = request.get("authorization");
    const parts = authorization?.trim().split(/\s+/) ?? [];
    const scheme = parts[0];
    const token = parts[1];

    if (scheme?.toLowerCase() !== "bearer" || !token || parts.length !== 2) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: fetchImplementation,
        },
      });
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        const status = error?.status === 401 || error?.status === 403 ? 401 : 503;
        response.status(status).json({
          error: status === 401 ? "Unauthorized" : "Authentication service unavailable",
        });
        return;
      }

      request.user = data.user;
      request.supabase = supabase;
      next();
    } catch (error) {
      next(error);
    }
  };
}
