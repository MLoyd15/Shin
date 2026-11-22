import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const client = getBrowserSupabaseClient();
      const result = mode === "sign-in"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "sign-up" && !result.data.session) setMessage("Check your email to confirm your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in could not be completed.");
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Link className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" to="/">FolioAgent</Link>
        <h1 className="mt-5 text-2xl font-semibold">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your holdings.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="auth-email">Email</label>
          <Input id="auth-email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label className="block text-sm font-medium" htmlFor="auth-password">Password</label>
          <Input id="auth-password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {message && <p className="text-sm text-destructive" role="status">{message}</p>}
          <Button className="w-full" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</Button>
        </form>
        <button className="mt-4 w-full rounded-md py-2 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }} type="button">
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
