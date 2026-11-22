import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@folioagent/shared";
import { Button } from "@/components/ui/button";
import type { DashboardHoldingView, DashboardSortKey } from "@/lib/dashboard-calculations";

const columns: Array<{ key: DashboardSortKey; label: string; align: "left" | "right" }> = [
  { key: "ticker", label: "Holding", align: "left" },
  { key: "shares", label: "Shares", align: "right" },
  { key: "currentPrice", label: "Price", align: "right" },
  { key: "marketValue", label: "Market value", align: "right" },
  { key: "dayChange", label: "Day change", align: "right" },
];

function ChangeValue({ holding }: { holding: DashboardHoldingView }) {
  if (!holding.dayChange) return <span className="text-muted-foreground">—</span>;
  const { amount, direction } = holding.dayChange;
  const sign = direction === "positive" ? "+" : "";
  const label = `${direction === "positive" ? "Up" : direction === "negative" ? "Down" : "Unchanged"} ${formatCurrency(amount)}`;

  return (
    <span
      aria-label={label}
      className={`inline-flex items-center justify-end gap-1 font-medium ${
        direction === "negative"
          ? "text-negative"
          : direction === "positive"
            ? "text-positive"
            : "text-muted-foreground"
      }`}
    >
      <span aria-hidden="true">
        {direction === "positive" ? "↑" : direction === "negative" ? "↓" : "—"}
      </span>
      <span>
        {sign}
        {formatCurrency(amount)}
      </span>
    </span>
  );
}

function TickerIdentity({ holding }: { holding: DashboardHoldingView }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary"
      >
        {holding.ticker.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-foreground">{holding.ticker}</span>
        <span className="block truncate text-xs text-muted-foreground">{holding.name}</span>
      </span>
    </div>
  );
}

function Sparkline({ holding }: { holding: DashboardHoldingView }) {
  return (
    <svg aria-hidden="true" className="h-7 w-20" viewBox="0 0 80 24" preserveAspectRatio="none">
      <polyline
        points={holding.sparklinePoints}
        fill="none"
        stroke="var(--chart-1)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function sortIcon(active: boolean, descending: boolean) {
  if (!active) return <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />;
  return descending ? (
    <ArrowDown aria-hidden="true" className="size-3.5 text-primary" />
  ) : (
    <ArrowUp aria-hidden="true" className="size-3.5 text-primary" />
  );
}

export function DashboardHoldingsTable({
  holdings,
  sort,
  onSort,
}: {
  holdings: DashboardHoldingView[];
  sort: { key: DashboardSortKey; descending: boolean };
  onSort: (key: DashboardSortKey) => void;
}) {
  return (
    <section
      aria-labelledby="dashboard-holdings-title"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 id="dashboard-holdings-title" className="text-sm font-semibold text-foreground">
            Holdings
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            End-of-day values · current share counts
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
          <Link to="/holdings">Manage holdings</Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 min-[640px]:hidden">
        <label htmlFor="mobile-holdings-sort" className="text-xs text-muted-foreground">
          Sort by
        </label>
        <select
          id="mobile-holdings-sort"
          className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          value={sort.key}
          onChange={(event) => onSort(event.target.value as DashboardSortKey)}
        >
          {columns.map((column) => (
            <option key={column.key} value={column.key}>
              {column.label}
            </option>
          ))}
        </select>
        <Button
          aria-label={sort.descending ? "Sort ascending" : "Sort descending"}
          className="size-9 shrink-0"
          onClick={() => onSort(sort.key)}
          size="icon"
          variant="outline"
        >
          {sortIcon(true, sort.descending)}
        </Button>
      </div>

      <div className="hidden max-h-[28rem] overflow-auto min-[640px]:block">
        <table
          aria-label="Portfolio holdings and daily performance"
          className="w-full border-collapse text-sm"
        >
          <thead className="sticky top-0 z-10 border-b border-border bg-card">
            <tr>
              {columns.map((column) => {
                const active = sort.key === column.key;
                const ariaSort = active ? (sort.descending ? "descending" : "ascending") : "none";
                return (
                  <th
                    key={column.key}
                    aria-sort={ariaSort}
                    className={`h-11 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={`inline-flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        column.align === "right" ? "flex-row-reverse" : ""
                      }`}
                    >
                      {column.label}
                      {sortIcon(active, sort.descending)}
                    </button>
                  </th>
                );
              })}
              <th className="px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {holdings.map((holding) => (
              <tr key={holding.ticker} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <TickerIdentity holding={holding} />
                  {holding.stale && (
                    <span className="mt-1 block text-xs text-warning">
                      Stale · as of {formatDate(holding.asOf)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{holding.shares}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {formatCurrency(holding.currentPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                  {formatCurrency(holding.marketValue)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <ChangeValue holding={holding} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Sparkline holding={holding} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 min-[640px]:hidden">
        {holdings.map((holding) => (
          <article key={holding.ticker} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <TickerIdentity holding={holding} />
              <Sparkline holding={holding} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-right">
              <div>
                <dt className="text-xs text-muted-foreground">Shares</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">{holding.shares}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Price</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">
                  {formatCurrency(holding.currentPrice)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Market value</dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {formatCurrency(holding.marketValue)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Day change</dt>
                <dd className="mt-1 font-mono text-sm">
                  <ChangeValue holding={holding} />
                </dd>
              </div>
            </dl>
            {holding.stale && (
              <p className="mt-3 text-xs text-warning">
                Stale price · as of {formatDate(holding.asOf)}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
