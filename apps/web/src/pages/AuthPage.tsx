import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getAuthActions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMessage = {
  kind: "error" | "success";
  text: string;
};

function isEmailNotConfirmed(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "email_not_confirmed") return true;
  return (
    "message" in error &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("email not confirmed")
  );
}

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const submittedMode = mode;
    const normalizedEmail = email.trim();
    try {
      const auth = getAuthActions();
      const result =
        submittedMode === "sign-in"
          ? await auth.signInWithEmail({ email: normalizedEmail, password })
          : await auth.signUpWithEmail(
              { email: normalizedEmail, password },
              new URL("/login", window.location.origin).toString(),
            );
      if (result.error) throw result.error;
      if (submittedMode === "sign-up" && !result.data.session) {
        setPendingConfirmationEmail(normalizedEmail);
        setMessage({
          kind: "success",
          text: "Account created. Confirm your email before signing in. Check your inbox and spam folder for the link.",
        });
      }
    } catch (error) {
      if (isEmailNotConfirmed(error)) {
        setPendingConfirmationEmail(normalizedEmail);
        setMessage({
          kind: "error",
          text: "Confirm your email before signing in. You can resend the confirmation link below.",
        });
      } else {
        setMessage({
          kind: "error",
          text: error instanceof Error ? error.message : "Sign in could not be completed.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setResending(true);
    setMessage(null);
    try {
      const { error } = await getAuthActions().resendSignupConfirmation(
        pendingConfirmationEmail,
        new URL("/login", window.location.origin).toString(),
      );
      if (error) throw error;
      setMessage({
        kind: "success",
        text: "A new confirmation email was sent. Check your inbox and spam folder.",
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The confirmation email could not be sent.",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Link className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" to="/">
          FolioAgent
        </Link>
        <h1 className="mt-5 text-2xl font-semibold">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Sign in to manage your holdings."
            : "Create an account to manage your holdings."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="auth-email">
            Email
          </label>
          <Input
            id="auth-email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="block text-sm font-medium" htmlFor="auth-password">
            Password
          </label>
          <Input
            id="auth-password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {message && (
            <p
              className={
                message.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"
              }
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {pendingConfirmationEmail && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Confirmation for {pendingConfirmationEmail}
            </p>
            <Button
              className="w-full"
              type="button"
              variant="outline"
              onClick={() => void resendConfirmation()}
              disabled={resending || busy}
            >
              {resending ? "Sending…" : "Resend confirmation email"}
            </Button>
          </div>
        )}
        <button
          className="mt-4 w-full rounded-md py-2 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setMessage(null);
          }}
          type="button"
          disabled={busy || resending}
        >
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
