import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient(
  supabaseUrl: string | undefined,
  publishableKey: string | undefined,
): SupabaseClient {
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable auth");
  }

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
}

export function getBrowserSupabaseClient(): SupabaseClient {
  browserClient ??= createBrowserSupabaseClient(
    import.meta.env["VITE_SUPABASE_URL"],
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  );
  return browserClient;
}
