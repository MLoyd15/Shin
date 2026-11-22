import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, Clock3, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate, formatPercent } from "@folioagent/shared";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PortfolioAllocations,
  PortfolioHistoryChart,
  RiskPanel,
} from "@/components/dashboard/DashboardCharts";
import { DashboardHoldingsTable } from "@/components/dashboard/DashboardHoldingsTable";
import { ScenarioSimulator } from "@/components/dashboard/ScenarioSimulator";
import { useDashboard } from "@/hooks/useDashboard";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  createDashboardSnapshot,
  evaluateScenario,
  sortDashboardHoldings,
  type DashboardSnapshot,
  type DashboardSortKey,
  type MetricView,
  type ScenarioRuleInput,
} from "@/lib/dashboard-calculations";

function MetricCard({ title, metric }: { title: string; metric: MetricView | null }) {
  const direction = metric?.direction ?? "neutral";
  const Icon =
    direction === "positive" ? ArrowUpRight : direction === "negative" ? ArrowDownRight : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      {metric ? (
        <div
          aria-label={`${title}: ${direction}, ${formatCurrency(metric.amount)}`}
          className={`mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight ${
            direction === "positive"
              ? "text-positive"
              : direction === "negative"
                ? "text-negative"
                : "text-foreground"
          }`}
        >
          {Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}
          <span>
            {direction === "positive" ? "+" : ""}
            {formatCurrency(metric.amount)}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xl font-semibold tracking-tight text-muted-foreground">—</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {metric?.percent === null || !metric
          ? "Percent unavailable"
          : `${direction === "positive" ? "+" : ""}${formatPercent(metric.percent)}`}
      </p>
    </section>
  );
}

function SummaryCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Total portfolio value</h2>
            <p className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {formatCurrency(snapshot.currentValue)}
            </p>
          </div>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            End-of-day
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Last updated: {snapshot.lastUpdated ? formatDate(snapshot.lastUpdated) : "—"}
          </span>
          {snapshot.stale && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-1 font-medium text-warning">
              Stale prices
            </span>
          )}
        </div>
      </section>
      <MetricCard title="Day change" metric={snapshot.dayChange} />
      <MetricCard title="Gain / loss" metric={snapshot.gainLoss} />
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard" role="status">
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-1" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-80" />
      <span className="sr-only">Loading portfolio data…</span>
    </div>
  );
}

function DashboardEmpty() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
      <div className="mx-auto max-w-xl text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
        >
          <BriefcaseBusiness className="size-7" />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Your portfolio, at a glance
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Start with your first holding
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Add a position or import a CSV to see its value, allocation, daily movement, and risk
          history here. Your portfolio is private to your account.
        </p>
        <Button asChild className="mt-6">
          <Link to="/holdings">Add or import holdings</Link>
        </Button>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
        {[
          ["01", "Track value", "End-of-day closes"],
          ["02", "Understand exposure", "Stock and sector mix"],
          ["03", "Explore scenarios", "Ticker and tag based"],
        ].map(([number, title, caption]) => (
          <div key={number} className="rounded-lg border border-border/70 bg-surface p-3 text-left">
            <span className="text-xs font-semibold text-primary">{number}</span>
            <p className="mt-2 text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section
      aria-labelledby="dashboard-error-title"
      className="rounded-xl border border-negative/40 bg-card p-6"
      role="alert"
    >
      <h2 id="dashboard-error-title" className="text-base font-semibold text-foreground">
        Dashboard data couldn’t load
      </h2>
      <p className="mt-2 break-words text-sm text-muted-foreground">{message}</p>
      <Button className="mt-4 gap-2" onClick={onRetry} variant="outline">
        <RefreshCw aria-hidden="true" className="size-4" />
        Try again
      </Button>
    </section>
  );
}

export function DashboardPage({ session }: { session: Session }) {
  const navigate = useNavigate();
  const { holdings, prices, loading, error, refresh } = useDashboard(session);
  const [sort, setSort] = useState<{ key: DashboardSortKey; descending: boolean }>({
    key: "marketValue",
    descending: true,
  });
  const [scenarioRules, setScenarioRules] = useState<ScenarioRuleInput[]>([]);

  const calculation = useMemo(() => {
    if (!holdings || !prices) return { snapshot: null, error: "" };
    try {
      return { snapshot: createDashboardSnapshot(holdings, prices), error: "" };
    } catch (reason) {
      if (reason instanceof RangeError) return { snapshot: null, error: reason.message };
      throw reason;
    }
  }, [holdings, prices]);
  const snapshot = calculation.snapshot;
  const sortedHoldings = useMemo(
    () => sortDashboardHoldings(snapshot?.holdings ?? [], sort),
    [snapshot, sort],
  );
  const availableTickers = useMemo(
    () =>
      (holdings ?? [])
        .map((holding) => holding.ticker)
        .sort((left, right) => left.localeCompare(right)),
    [holdings],
  );
  const availableTags = useMemo(
    () =>
      [...new Set((holdings ?? []).flatMap((holding) => holding.tags))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [holdings],
  );
  const scenario = useMemo(
    () => evaluateScenario(holdings ?? [], prices ?? [], scenarioRules),
    [holdings, prices, scenarioRules],
  );

  const signOut = useCallback(async () => {
    await getBrowserSupabaseClient().auth.signOut();
    navigate("/login", { replace: true });
  }, [navigate]);

  function addScenarioRule() {
    const targetType = availableTags.length > 0 ? "tag" : "ticker";
    setScenarioRules((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        targetType,
        targetValue: targetType === "tag" ? (availableTags[0] ?? "") : (availableTickers[0] ?? ""),
        changePercent: "",
      },
    ]);
  }

  function updateScenarioRule(id: string, changes: Partial<Omit<ScenarioRuleInput, "id">>) {
    setScenarioRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    );
  }

  function removeScenarioRule(id: string) {
    setScenarioRules((current) => current.filter((rule) => rule.id !== id));
  }

  function sortBy(key: DashboardSortKey) {
    setSort((current) => ({
      key,
      descending: current.key === key ? !current.descending : key !== "ticker",
    }));
  }

  return (
    <AppShell session={session} onSignOut={signOut}>
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Portfolio overview
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Dashboard
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Market values use end-of-day closing prices.
          </p>
        </header>

        {loading ? (
          <DashboardLoading />
        ) : error || calculation.error ? (
          <DashboardError message={error || calculation.error} onRetry={refresh} />
        ) : !snapshot || (holdings?.length ?? 0) === 0 ? (
          <DashboardEmpty />
        ) : (
          <>
            <SummaryCards snapshot={snapshot} />

            {snapshot.stale && (
              <p
                className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
                role="status"
              >
                One or more prices are stale. Values are labeled by holding and use the latest
                cached closes available.
              </p>
            )}

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]">
              <div className="min-w-0">
                <PortfolioHistoryChart history={snapshot.history} />
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <PortfolioAllocations snapshot={snapshot} />
              </div>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
              <DashboardHoldingsTable holdings={sortedHoldings} sort={sort} onSort={sortBy} />
              <RiskPanel snapshot={snapshot} />
            </div>

            <ScenarioSimulator
              tickers={availableTickers}
              tags={availableTags}
              rules={scenarioRules}
              evaluation={scenario}
              onAddRule={addScenarioRule}
              onUpdateRule={updateScenarioRule}
              onRemoveRule={removeScenarioRule}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
