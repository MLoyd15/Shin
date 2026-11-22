import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Decimal from "decimal.js";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { calculateCostBasis } from "@/lib/allocation";

export interface Holding {
  ticker: string;
  shares: string;
  avg_cost: string;
  tags: string[];
}

export interface ImportError {
  field: string;
  reason: string;
}

export interface PreviewRow {
  rowNumber: number;
  status: "valid" | "skipped";
  values: Record<string, string>;
  errors: ImportError[];
}

export interface Preview {
  rows: PreviewRow[];
  willImport: number;
  skipped: number;
  previewToken: string;
}

export type Editable = Pick<Holding, "shares" | "avg_cost" | "tags">;
export type SortKey = "ticker" | "shares" | "avg_cost" | "costBasis" | "tags";

const API = (import.meta.env["VITE_API_URL"] ?? "http://localhost:4000").replace(/\/$/, "");

export function useHoldings({
  session,
  demoState,
}: {
  session: Session;
  demoState?: "empty" | "populated" | "import-errors" | undefined;
}) {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "ticker", desc: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [draft, setDraft] = useState({ ticker: "", shares: "", avg_cost: "", tags: "" });
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [holdingToDelete, setHoldingToDelete] = useState<Holding | null>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [rawCsv, setRawCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importError, setImportError] = useState("");

  const pendingDeletions = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const pending = pendingDeletions.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? ((await response.json()) as { error?: string })
        : await response.text();
      if (!response.ok) {
        throw new Error(
          typeof body === "object" && body.error
            ? body.error
            : `Request failed (${response.status})`,
        );
      }
      return body;
    },
    [session.access_token],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    if (demoState) {
      setHoldings(
        demoState === "empty"
          ? []
          : [
              { ticker: "AAPL", shares: "12.5", avg_cost: "188.25", tags: ["core", "long-term"] },
              { ticker: "MSFT", shares: "8", avg_cost: "412.60", tags: ["growth"] },
              { ticker: "KO", shares: "30", avg_cost: "61.04", tags: ["dividend"] },
            ],
      );
      setLoading(false);
      return;
    }
    try {
      setHoldings((await authFetch("/api/holdings")) as Holding[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load holdings.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, demoState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (demoState !== "import-errors") return;
    setPreview({
      willImport: 2,
      skipped: 2,
      previewToken: "screenshot-only",
      rows: [
        {
          rowNumber: 2,
          status: "valid",
          values: { ticker: "AAPL", shares: "12.5", avg_cost: "188.25" },
          errors: [],
        },
        {
          rowNumber: 3,
          status: "skipped",
          values: { ticker: "ZZZZ", shares: "4", avg_cost: "28.50" },
          errors: [{ field: "ticker", reason: "Unknown ticker" }],
        },
        {
          rowNumber: 4,
          status: "skipped",
          values: { ticker: "MSFT", shares: "0", avg_cost: "412" },
          errors: [{ field: "shares", reason: "shares must be greater than zero" }],
        },
        {
          rowNumber: 5,
          status: "valid",
          values: { ticker: "KO", shares: "30", avg_cost: "61.04" },
          errors: [],
        },
      ],
    });
    setRawCsv("ticker,shares,avg_cost\nAAPL,12.5,188.25\nZZZZ,4,28.50\nMSFT,0,412\nKO,30,61.04");
    setImportDialogOpen(true);
  }, [demoState]);

  const filteredAndSorted = useMemo(() => {
    let resultList = holdings;

    if (selectedTag) {
      resultList = resultList.filter((h) => h.tags.includes(selectedTag));
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      resultList = resultList.filter(
        (h) =>
          h.ticker.toLowerCase().includes(q) || h.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return [...resultList].sort((left, right) => {
      let result: number;
      if (sort.key === "ticker") {
        result = left.ticker.localeCompare(right.ticker);
      } else if (sort.key === "tags") {
        result = left.tags.join(",").localeCompare(right.tags.join(","));
      } else if (sort.key === "costBasis") {
        const leftBasis = calculateCostBasis(left.shares, left.avg_cost);
        const rightBasis = calculateCostBasis(right.shares, right.avg_cost);
        result = leftBasis.comparedTo(rightBasis);
      } else {
        result = new Decimal(left[sort.key]).comparedTo(new Decimal(right[sort.key]));
      }
      return sort.desc ? -result : result;
    });
  }, [holdings, searchQuery, selectedTag, sort]);

  function beginAdd() {
    setEditing(null);
    setDraft({ ticker: "", shares: "", avg_cost: "", tags: "" });
    setFormError("");
    setSheetOpen(true);
  }

  function beginEdit(holding: Holding) {
    setEditing(holding);
    setDraft({
      ticker: holding.ticker,
      shares: holding.shares,
      avg_cost: holding.avg_cost,
      tags: holding.tags.join("; "),
    });
    setFormError("");
    setSheetOpen(true);
  }

  async function saveHolding(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      const tags = draft.tags
        .split(";")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload: Editable = { shares: draft.shares, avg_cost: draft.avg_cost, tags };
      const path = editing
        ? `/api/holdings/${encodeURIComponent(editing.ticker)}`
        : "/api/holdings";
      await authFetch(path, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(
          editing ? payload : { ticker: draft.ticker.trim().toUpperCase(), ...payload },
        ),
      });
      toast.success(
        editing ? `Updated ${editing.ticker}` : `Added ${draft.ticker.trim().toUpperCase()}`,
      );
      setSheetOpen(false);
      await refresh();
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Could not save holding.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function updateHoldingOptimistic(ticker: string, changes: Partial<Editable>) {
    const prevHoldings = holdings;
    const currentHolding = holdings.find((h) => h.ticker === ticker);
    if (!currentHolding) return;

    const updatedHolding: Holding = {
      ...currentHolding,
      ...changes,
      tags: changes.tags ?? currentHolding.tags,
    };

    setHoldings((prev) => prev.map((h) => (h.ticker === ticker ? updatedHolding : h)));

    try {
      const payload: Editable = {
        shares: updatedHolding.shares,
        avg_cost: updatedHolding.avg_cost,
        tags: updatedHolding.tags,
      };
      await authFetch(`/api/holdings/${encodeURIComponent(ticker)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success(`Updated ${ticker}`);
    } catch (reason) {
      setHoldings(prevHoldings);
      const msg = reason instanceof Error ? reason.message : "Could not update holding.";
      toast.error(msg);
    }
  }

  function beginDelete(holding: Holding) {
    setHoldingToDelete(holding);
    setDeleteDialogOpen(true);
  }

  function deleteWithUndo(holding: Holding) {
    setHoldings((prev) => prev.filter((h) => h.ticker !== holding.ticker));

    const timer = setTimeout(async () => {
      pendingDeletions.current.delete(holding.ticker);
      try {
        await authFetch(`/api/holdings/${encodeURIComponent(holding.ticker)}`, {
          method: "DELETE",
        });
      } catch (reason) {
        const msg = reason instanceof Error ? reason.message : "Could not delete holding.";
        toast.error(msg);
        void refresh();
      }
    }, 5000);

    pendingDeletions.current.set(holding.ticker, timer);

    toast(`Deleted ${holding.ticker}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingDeletions.current.get(holding.ticker);
          if (pending) {
            clearTimeout(pending);
            pendingDeletions.current.delete(holding.ticker);
            setHoldings((prev) => [...prev, holding]);
            toast.success(`Restored ${holding.ticker}`);
          }
        },
      },
    });
  }

  async function confirmDelete() {
    if (!holdingToDelete) return;
    const target = holdingToDelete;
    setDeleteDialogOpen(false);
    setHoldingToDelete(null);
    deleteWithUndo(target);
  }

  async function bulkDelete(tickers: string[]) {
    if (tickers.length === 0) return;
    setBusy(true);
    const toDeleteSet = new Set(tickers);
    const previous = holdings;
    setHoldings((prev) => prev.filter((h) => !toDeleteSet.has(h.ticker)));

    try {
      await Promise.all(
        tickers.map((t) =>
          authFetch(`/api/holdings/${encodeURIComponent(t)}`, {
            method: "DELETE",
          }),
        ),
      );
      toast.success(`Deleted ${tickers.length} ${tickers.length === 1 ? "holding" : "holdings"}`);
    } catch (reason) {
      setHoldings(previous);
      const msg = reason instanceof Error ? reason.message : "Could not delete selected holdings.";
      toast.error(msg);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function selectCsv(file?: File) {
    if (!file) return;
    setImportError("");
    setPreview(null);
    if (file.size > 1_048_576) {
      const err = "CSV exceeds the 1 MiB file size limit.";
      setImportError(err);
      toast.error(err);
      return;
    }
    const raw = await file.text();
    setRawCsv(raw);
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/holdings/import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "text/csv" },
        body: raw,
      });
      const body = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Preview failed (${response.status})`);
      setPreview(body);
      setImportDialogOpen(true);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Could not preview CSV.";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    setImportError("");
    try {
      const response = await fetch(`${API}/api/holdings/import/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "text/csv",
          "x-import-preview-token": preview.previewToken,
        },
        body: rawCsv,
      });
      const body = (await response.json()) as {
        error?: string;
        inserted?: number;
        skipped?: number;
      };
      if (!response.ok) throw new Error(body.error ?? `Import failed (${response.status})`);
      toast.success(`${body.inserted ?? 0} imported, ${body.skipped ?? 0} skipped.`);
      setPreview(null);
      setRawCsv("");
      setImportDialogOpen(false);
      await refresh();
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Could not import CSV.";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    try {
      const response = await fetch(`${API}/api/holdings/import/template`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error("Could not download the template.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "holdings-template.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Could not download the template.";
      toast.error(msg);
    }
  }

  async function signOut() {
    await getBrowserSupabaseClient().auth.signOut();
    navigate("/login", { replace: true });
  }

  return {
    holdings,
    filteredHoldings: filteredAndSorted,
    loading,
    error,
    refresh,
    sort,
    setSort,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    sheetOpen,
    setSheetOpen,
    editing,
    draft,
    setDraft,
    formError,
    busy,
    beginAdd,
    beginEdit,
    saveHolding,
    updateHoldingOptimistic,
    deleteDialogOpen,
    setDeleteDialogOpen,
    holdingToDelete,
    beginDelete,
    confirmDelete,
    deleteWithUndo,
    bulkDelete,
    importDialogOpen,
    setImportDialogOpen,
    preview,
    setPreview,
    rawCsv,
    setRawCsv,
    importError,
    selectCsv,
    confirmImport,
    downloadTemplate,
    signOut,
  };
}
