import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "./supabase.js";

export interface EmailCredentials {
  email: string;
  password: string;
}

export type AuthGateway = Pick<
  SupabaseClient["auth"],
  "signUp" | "signInWithPassword" | "signInWithOAuth" | "signOut"
>;

export function createAuthActions(auth: AuthGateway) {
  return {
    signUpWithEmail(credentials: EmailCredentials) {
      return auth.signUp(credentials);
    },
    signInWithEmail(credentials: EmailCredentials) {
      return auth.signInWithPassword(credentials);
    },
    signInWithGoogle(redirectTo: string) {
      return auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
    },
    signOut() {
      return auth.signOut();
    },
  };
}

export function getAuthActions() {
  return createAuthActions(getBrowserSupabaseClient().auth);
}
