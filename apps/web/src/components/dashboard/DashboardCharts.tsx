import type { ReactNode } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "@folioagent/shared";
import type {
  AllocationView,
  DashboardHistoryPoint,
  DashboardSnapshot,
} from "@/lib/dashboard-calculations";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function PortfolioHistoryChart({ history }: { history: DashboardHistoryPoint[] }) {
  return (
    <ChartCard title="Portfolio value" description="backtest of current holdings">
      {history.length < 2 ? (
        <div className="grid h-56 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
          Not enough historical prices yet to draw a trend.
        </div>
      ) : (
        <div
          aria-label="Portfolio value over time, backtest of current holdings"
          className="h-56 w-full"
          role="img"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDate(value)}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                dataKey="chartValue"
                tickFormatter={(value: number) => formatCompact(String(value))}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(String(value ?? "0")), "Portfolio value"]}
                labelFormatter={(label) => formatDate(String(label))}
                contentStyle={{
                  backgroundColor: "var(--surface-elevated)",
                  borderColor: "var(--border)",
                  borderRadius: "0.75rem",
                  color: "var(--text)",
                }}
              />
              <Line
                dataKey="chartValue"
                name="Portfolio value"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "var(--chart-1)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="sr-only">
        Values use current share counts against each historical end-of-day close.
      </p>
    </ChartCard>
  );
}

function AllocationChart({ title, data }: { title: string; data: AllocationView[] }) {
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <div className="grid h-48 place-items-center text-sm text-muted-foreground">
          Allocation data will appear when holdings are added.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center">
          <div aria-label={`${title} chart`} className="h-48 min-w-0" role="img">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="chartValue"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="84%"
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.label}
                      fill={chartColors[index % chartColors.length] ?? chartColors[0]!}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatCurrency(String(value ?? "0")), "Market value"]}
                  contentStyle={{
                    backgroundColor: "var(--surface-elevated)",
                    borderColor: "var(--border)",
                    borderRadius: "0.75rem",
                    color: "var(--text)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="max-h-48 min-w-0 space-y-2 overflow-y-auto" aria-label={`${title} legend`}>
            {data.map((item, index) => (
              <li key={item.label} className="flex min-w-0 items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: chartColors[index % chartColors.length] ?? chartColors[0]!,
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
                <span className="shrink-0 text-right font-medium text-foreground">
                  {item.percent === null ? "—" : formatPercent(item.percent)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

export function PortfolioAllocations({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <>
      <AllocationChart title="Allocation by stock" data={snapshot.allocationByPosition} />
      <AllocationChart title="Allocation by sector" data={snapshot.allocationBySector} />
    </>
  );
}

export function RiskPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const metrics = [
    {
      label: "Largest position",
      value: snapshot.largestPosition
        ? `${snapshot.largestPosition.label} · ${formatCurrency(snapshot.largestPosition.value)}`
        : "—",
      detail:
        snapshot.largestPosition?.percent === null || !snapshot.largestPosition
          ? "No position data"
          : formatPercent(snapshot.largestPosition.percent),
    },
    {
      label: "Sector concentration",
      value: snapshot.sectorConcentration?.label ?? "No sector data",
      detail: snapshot.sectorConcentration?.percent
        ? formatPercent(snapshot.sectorConcentration.percent)
        : "—",
    },
    {
      label: "Annualized volatility",
      value:
        snapshot.volatility === null ? "Not enough history" : formatPercent(snapshot.volatility),
      detail: "Based on daily returns",
    },
    {
      label: "Maximum drawdown",
      value:
        snapshot.maxDrawdown === null ? "Not enough history" : formatPercent(snapshot.maxDrawdown),
      detail: "Peak-to-trough decline",
    },
  ];

  return (
    <section
      aria-labelledby="risk-panel-title"
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4">
        <h2 id="risk-panel-title" className="text-sm font-semibold text-foreground">
          Risk snapshot
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Portfolio exposure and historical risk</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded-lg border border-border/70 bg-surface p-3"
          >
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{metric.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
