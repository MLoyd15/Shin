import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthActions, type AuthGateway } from "./auth.js";

describe("browser auth actions", () => {
  let auth: AuthGateway;

  beforeEach(() => {
    auth = {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    } as unknown as AuthGateway;
  });

  it("uses Supabase email sign-up", async () => {
    await createAuthActions(auth).signUpWithEmail({
      email: "investor@example.test",
      password: "correct-horse-battery-staple",
    });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: "investor@example.test",
      password: "correct-horse-battery-staple",
    });
  });

  it("uses Supabase email password sign-in", async () => {
    await createAuthActions(auth).signInWithEmail({
      email: "investor@example.test",
      password: "correct-horse-battery-staple",
    });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "investor@example.test",
      password: "correct-horse-battery-staple",
    });
  });

  it("starts Google OAuth with the requested callback URL", async () => {
    await createAuthActions(auth).signInWithGoogle("https://folio.example/auth/callback");

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://folio.example/auth/callback" },
    });
  });
});
