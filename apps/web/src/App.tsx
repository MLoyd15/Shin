import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { DesignSystemPage } from "./pages/DesignSystemPage.js";
import { AuthPage } from "./pages/AuthPage.js";
import { HoldingsPage } from "./pages/HoldingsPage.js";
import { getBrowserSupabaseClient } from "./lib/supabase.js";

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div>
        <p className="text-sm text-muted-foreground">This page is unavailable.</p>
        <a
          className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          href="/"
        >
          Return to FolioAgent
        </a>
      </div>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const demoState = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("demo") : null;

  useEffect(() => {
    if (demoState === "empty" || demoState === "populated" || demoState === "import-errors") {
      setSession({
        access_token: "screenshot-only",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "screenshot-only",
        user: { id: "demo-user", aud: "authenticated", role: "authenticated", email: "demo@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00.000Z" },
      } as Session);
      setAuthReady(true);
      return;
    }
    try {
      const client = getBrowserSupabaseClient();
      void client.auth.getSession().then(({ data, error }) => {
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthReady(true);
      }).catch((error: unknown) => {
        setAuthError(error instanceof Error ? error.message : "Authentication could not initialize.");
        setAuthReady(true);
      });
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
      return () => subscription.unsubscribe();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Set Supabase auth configuration.");
      setAuthReady(true);
    }
  }, [demoState]);

  const authGate = (element: ReactNode) => {
    if (!authReady) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading your session…</main>;
    if (!session) return <Navigate to="/login" replace />;
    return element;
  };

  return (
    <Routes>
      <Route path="/design" element={import.meta.env.DEV ? <DesignSystemPage /> : <NotFound />} />
      <Route path="/login" element={session ? <Navigate to="/holdings" replace /> : <AuthPage />} />
      <Route path="/holdings" element={authGate(<HoldingsPage session={session!} {...(demoState === "empty" || demoState === "populated" || demoState === "import-errors" ? { demoState } : {})} />)} />
      <Route
        path="/"
        element={authError && authReady ? <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-sm text-destructive">{authError}</main> : <Navigate to={session ? "/holdings" : "/login"} replace />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
