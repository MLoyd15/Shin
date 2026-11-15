import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserSupabaseClient, getBrowserSupabaseClient } from "./supabase.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createBrowserSupabaseClient", () => {
  it("requires both public Supabase settings", () => {
    expect(() => createBrowserSupabaseClient(undefined, undefined)).toThrow(
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable auth",
    );
  });

  it("creates a browser client when public settings are present", () => {
    const client = createBrowserSupabaseClient("http://supabase.test", "test-publishable-key");

    expect(client.auth).toBeDefined();
  });

  it("reuses one client so auth state and refresh timers stay shared", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");

    expect(getBrowserSupabaseClient()).toBe(getBrowserSupabaseClient());
  });
});
