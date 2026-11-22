import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "./supabase.js";

export interface EmailCredentials {
  email: string;
  password: string;
}

export type AuthGateway = Pick<
  SupabaseClient["auth"],
  "signUp" | "signInWithPassword" | "signInWithOAuth" | "signOut" | "resend"
>;

export function createAuthActions(auth: AuthGateway) {
  return {
    signUpWithEmail(credentials: EmailCredentials, emailRedirectTo: string) {
      return auth.signUp({
        ...credentials,
        options: { emailRedirectTo },
      });
    },
    signInWithEmail(credentials: EmailCredentials) {
      return auth.signInWithPassword(credentials);
    },
    resendSignupConfirmation(email: string, emailRedirectTo: string) {
      return auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
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
