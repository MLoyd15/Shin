import Decimal from "decimal.js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrency } from "@folioagent/shared";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Holding { ticker: string; shares: string; avg_cost: string; tags: string[] }
interface ImportError { field: string; reason: string }
interface PreviewRow { rowNumber: number; status: "valid" | "skipped"; values: Record<string, string>; errors: ImportError[] }
interface Preview { rows: PreviewRow[]; willImport: number; skipped: number; previewToken: string }
type Editable = Pick<Holding, "shares" | "avg_cost" | "tags">;

const API = (import.meta.env["VITE_API_URL"] ?? "http://localhost:4000").replace(/\/$/, "");

export function HoldingsPage({ session, demoState }: { session: Session; demoState?: "empty" | "populated" | "import-errors" }) {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{ key: keyof Holding; desc: boolean }>({ key: "ticker", desc: false });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [draft, setDraft] = useState({ ticker: "", shares: "", avg_cost: "", tags: "" });
  const [formError, setFormError] = useState("");
  const [rawCsv, setRawCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importError, setImportError] = useState("");
  const [busy, setBusy] = useState(false);

  const authFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await response.json() as { error?: string } : await response.text();
    if (!response.ok) throw new Error(typeof body === "object" && body.error ? body.error : `Request failed (${response.status})`);
    return body;
  }, [session.access_token]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    if (demoState) {
      setHoldings(demoState === "empty" ? [] : [
        { ticker: "AAPL", shares: "12.5", avg_cost: "188.25", tags: ["core", "long-term"] },
        { ticker: "MSFT", shares: "8", avg_cost: "412.60", tags: ["growth"] },
        { ticker: "KO", shares: "30", avg_cost: "61.04", tags: ["dividend"] },
      ]);
      setLoading(false);
      return;
    }
    try { setHoldings(await authFetch("/api/holdings") as Holding[]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load holdings."); }
    finally { setLoading(false); }
  }, [authFetch, demoState]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("theme");
    const saved = window.localStorage.getItem("folioagent-theme");
    document.documentElement.classList.toggle("dark", requested === "light" ? false : requested === "dark" ? true : saved !== "light");
  }, []);
  useEffect(() => {
    if (demoState !== "import-errors") return;
    setPreview({
      willImport: 2,
      skipped: 2,
      previewToken: "screenshot-only",
      rows: [
        { rowNumber: 2, status: "valid", values: { ticker: "AAPL", shares: "12.5", avg_cost: "188.25" }, errors: [] },
        { rowNumber: 3, status: "skipped", values: { ticker: "ZZZZ", shares: "4", avg_cost: "28.50" }, errors: [{ field: "ticker", reason: "Unknown ticker" }] },
        { rowNumber: 4, status: "skipped", values: { ticker: "MSFT", shares: "0", avg_cost: "412" }, errors: [{ field: "shares", reason: "shares must be greater than zero" }] },
        { rowNumber: 5, status: "valid", values: { ticker: "KO", shares: "30", avg_cost: "61.04" }, errors: [] },
      ],
    });
    setRawCsv("ticker,shares,avg_cost\nAAPL,12.5,188.25\nZZZZ,4,28.50\nMSFT,0,412\nKO,30,61.04");
  }, [demoState]);

  const sorted = useMemo(() => [...holdings].sort((left, right) => {
    const a = left[sort.key]; const b = right[sort.key];
    const result = sort.key === "ticker"
      ? String(a).localeCompare(String(b))
      : sort.key === "tags"
        ? left.tags.join(",").localeCompare(right.tags.join(","))
        : new Decimal(a as string).comparedTo(new Decimal(b as string));
    return sort.desc ? -result : result;
  }), [holdings, sort]);

  function beginAdd() { setEditing(null); setDraft({ ticker: "", shares: "", avg_cost: "", tags: "" }); setFormError(""); setFormOpen(true); }
  function beginEdit(holding: Holding) { setEditing(holding); setDraft({ ticker: holding.ticker, shares: holding.shares, avg_cost: holding.avg_cost, tags: holding.tags.join("; ") }); setFormError(""); setFormOpen(true); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(""); setBusy(true);
    try {
      const tags = draft.tags.split(";").map((tag) => tag.trim()).filter(Boolean);
      const payload: Editable = { shares: draft.shares, avg_cost: draft.avg_cost, tags };
      const path = editing ? `/api/holdings/${encodeURIComponent(editing.ticker)}` : "/api/holdings";
      await authFetch(path, { method: editing ? "PATCH" : "POST", body: JSON.stringify(editing ? payload : { ticker: draft.ticker, ...payload }) });
      setFormOpen(false); await refresh();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Could not save holding."); }
    finally { setBusy(false); }
  }

  async function remove(holding: Holding) {
    if (!window.confirm(`Delete ${holding.ticker} from your holdings?`)) return;
    try { await authFetch(`/api/holdings/${encodeURIComponent(holding.ticker)}`, { method: "DELETE" }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete holding."); }
  }

  async function selectCsv(file?: File) {
    if (!file) return;
    setImportError(""); setPreview(null);
    if (file.size > 1_048_576) { setImportError("CSV exceeds the 1 MiB file size limit."); return; }
    const raw = await file.text(); setRawCsv(raw); setBusy(true);
    try {
      const response = await fetch(`${API}/api/holdings/import/preview`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "text/csv" }, body: raw });
      const body = await response.json() as Preview & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Preview failed (${response.status})`);
      setPreview(body);
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : "Could not preview CSV."); }
    finally { setBusy(false); }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true); setImportError("");
    try {
      const response = await fetch(`${API}/api/holdings/import/confirm`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "text/csv", "x-import-preview-token": preview.previewToken }, body: rawCsv });
      const body = await response.json() as { error?: string; inserted?: number; skipped?: number };
      if (!response.ok) throw new Error(body.error ?? `Import failed (${response.status})`);
      setPreview(null); setRawCsv(""); setImportError(`${body.inserted} imported, ${body.skipped} skipped.`); await refresh();
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : "Could not import CSV."); }
    finally { setBusy(false); }
  }

  async function downloadTemplate() {
    try {
      const response = await fetch(`${API}/api/holdings/import/template`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error("Could not download the template.");
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "holdings-template.csv"; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : "Could not download the template."); }
  }

  async function signOut() { await getBrowserSupabaseClient().auth.signOut(); navigate("/login", { replace: true }); }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/holdings" className="text-sm font-bold tracking-wide">FolioAgent</Link>
          <div className="flex items-center gap-3"><span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">{session.user.email}</span><Button variant="outline" size="sm" onClick={() => void signOut()}>Sign out</Button></div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Portfolio</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Holdings</h1><p className="mt-2 text-sm text-muted-foreground">Track the shares and cost you entered.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadTemplate}>Download CSV template</Button><label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">Import CSV<input aria-label="Choose holdings CSV" className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void selectCsv(event.target.files?.[0])} /></label><Button onClick={beginAdd}>Add holding</Button></div>
        </div>

        {formOpen && <section className="mt-6 rounded-2xl border border-border bg-card p-5" aria-label={editing ? "Edit holding" : "Add holding"}><form onSubmit={(event) => void save(event)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!editing && <label className="text-sm font-medium">Ticker<Input className="mt-1" autoFocus value={draft.ticker} onChange={(event) => setDraft({ ...draft, ticker: event.target.value })} placeholder="AAPL" required /></label>}
          {editing && <div className="text-sm font-medium">Ticker<Input className="mt-1" value={editing.ticker} disabled /></div>}
          <label className="text-sm font-medium">Shares<Input className="mt-1 tabular-nums" value={draft.shares} onChange={(event) => setDraft({ ...draft, shares: event.target.value })} inputMode="decimal" placeholder="12.5" required /></label>
          <label className="text-sm font-medium">Average cost (USD)<Input className="mt-1 tabular-nums" value={draft.avg_cost} onChange={(event) => setDraft({ ...draft, avg_cost: event.target.value })} inputMode="decimal" placeholder="185.40" required /></label>
          <label className="text-sm font-medium">Tags<Input className="mt-1" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="growth; long-term" /></label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add holding"}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>{formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}</div>
        </form></section>}

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Your holdings">
          {loading ? <div className="space-y-3" aria-label="Loading holdings"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-3/4"/></div>
          : error ? <div className="py-10 text-center"><p className="font-medium">Holdings couldn’t load</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" variant="outline" onClick={() => void refresh()}>Try again</Button></div>
          : holdings.length === 0 ? <div className="py-14 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-2xl text-accent-foreground" aria-hidden="true">＋</div><h2 className="mt-4 text-lg font-semibold">Your portfolio starts here</h2><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add a holding or import a CSV to keep your positions together.</p><Button className="mt-5" onClick={beginAdd}>Add your first holding</Button></div>
          : <>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Positions <span className="ml-1 text-sm font-normal text-muted-foreground">{holdings.length}</span></h2><p className="text-xs text-muted-foreground">USD cost per share</p></div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead className="sticky top-0 bg-card"><tr className="border-b border-border text-muted-foreground">{(["ticker", "shares", "avg_cost", "tags"] as const).map((key) => <th key={key} className={`px-3 py-3 font-medium ${key === "ticker" || key === "tags" ? "text-left" : "text-right"}`}><button className="rounded focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setSort((current) => ({ key, desc: current.key === key ? !current.desc : false }))}>{key === "avg_cost" ? "Avg cost" : key[0]!.toUpperCase() + key.slice(1)}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}</button></th>)}<th className="px-3 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{sorted.map((holding) => <tr key={holding.ticker} className="border-b border-border last:border-0"><td className="px-3 py-4 font-semibold"><span className="mr-3 inline-grid size-8 place-items-center rounded-lg bg-accent text-xs text-accent-foreground">{holding.ticker.slice(0, 1)}</span>{holding.ticker}</td><td className="px-3 py-4 text-right tabular-nums">{holding.shares}</td><td className="px-3 py-4 text-right tabular-nums">{formatCurrency(holding.avg_cost)}</td><td className="px-3 py-4 text-left text-muted-foreground">{holding.tags.length ? holding.tags.join(", ") : "—"}</td><td className="px-3 py-4 text-right"><Button size="sm" variant="ghost" onClick={() => beginEdit(holding)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => void remove(holding)}>Delete</Button></td></tr>)}</tbody></table></div>
            <div className="space-y-3 md:hidden">{sorted.map((holding) => <article className="rounded-xl border border-border p-4" key={holding.ticker}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">{holding.ticker.slice(0, 1)}</span><div><h3 className="font-semibold">{holding.ticker}</h3><p className="text-xs text-muted-foreground">{holding.tags.join(", ") || "No tags"}</p></div></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => beginEdit(holding)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => void remove(holding)}>Delete</Button></div></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Shares</dt><dd className="mt-1 tabular-nums">{holding.shares}</dd></div><div className="text-right"><dt className="text-xs text-muted-foreground">Avg cost</dt><dd className="mt-1 tabular-nums">{formatCurrency(holding.avg_cost)}</dd></div></dl></article>)}</div>
          </>}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="import-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="import-title" className="font-semibold">Import holdings</h2><p className="mt-1 text-sm text-muted-foreground">CSV supports ticker, shares, avg_cost, optional currency, and semicolon-separated tags.</p></div><p className="text-xs text-muted-foreground">Up to 1 MiB · 500 rows</p></div>
          {preview && <><p className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground" role="status">{preview.willImport} will import, {preview.skipped} skipped</p><div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Row</th><th className="p-2 text-left">Ticker</th><th className="p-2 text-left">Shares</th><th className="p-2 text-left">Avg cost</th><th className="p-2 text-left">Result</th></tr></thead><tbody>{preview.rows.map((row) => <tr className="border-t border-border align-top" key={row.rowNumber}><td className="p-2 tabular-nums">{row.rowNumber}</td><td className="p-2">{row.values["ticker"]}</td><td className="p-2 tabular-nums">{row.values["shares"]}</td><td className="p-2 tabular-nums">{row.values["avg_cost"]}</td><td className="p-2"><span className={row.status === "valid" ? "font-medium text-positive" : "font-medium text-negative"}>{row.status === "valid" ? "Will import" : "Skipped"}</span>{row.errors.map((item, index) => <p className="mt-1 text-negative" key={`${item.field}-${index}`}>{item.field}: {item.reason}</p>)}</td></tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || preview.willImport === 0} onClick={() => void confirmImport()}>{busy ? "Importing…" : `Import ${preview.willImport} rows`}</Button><Button variant="outline" onClick={() => { setPreview(null); setRawCsv(""); }}>Cancel</Button></div></>}
          {!preview && <label className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">Choose CSV file<input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void selectCsv(event.target.files?.[0])}/></label>}
          {busy && <p className="mt-3 text-sm text-muted-foreground" role="status">Working…</p>}{importError && <p className="mt-3 text-sm text-destructive" role="alert">{importError}</p>}
        </section>
      </div>
    </main>
  );
}
