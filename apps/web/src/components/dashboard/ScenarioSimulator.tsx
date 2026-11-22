import { ArrowDownRight, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatPercent } from "@folioagent/shared";
import { Button } from "@/components/ui/button";
import type { ScenarioEvaluation, ScenarioRuleInput } from "@/lib/dashboard-calculations";

export function ScenarioSimulator({
  tickers,
  tags,
  rules,
  evaluation,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}: {
  tickers: string[];
  tags: string[];
  rules: ScenarioRuleInput[];
  evaluation: ScenarioEvaluation;
  onAddRule: () => void;
  onUpdateRule: (id: string, changes: Partial<Omit<ScenarioRuleInput, "id">>) => void;
  onRemoveRule: (id: string) => void;
}) {
  return (
    <section
      aria-labelledby="scenario-title"
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="scenario-title" className="text-sm font-semibold text-foreground">
            Scenario simulator
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Apply percentage changes to a ticker or a holding tag. Matching adjustments compound.
          </p>
        </div>
        <Button className="w-full gap-2 sm:w-auto" onClick={onAddRule} size="sm" variant="outline">
          <Plus aria-hidden="true" className="size-4" />
          Add adjustment
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
            Add an adjustment to explore a what-if scenario.
          </p>
        ) : (
          rules.map((rule, index) => {
            const options = rule.targetType === "ticker" ? tickers : tags;
            return (
              <div
                key={rule.id}
                className="grid gap-2 rounded-lg border border-border/70 bg-surface p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-end"
              >
                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  Target type
                  <select
                    aria-label={`Adjustment ${index + 1} target type`}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    value={rule.targetType}
                    onChange={(event) =>
                      onUpdateRule(rule.id, {
                        targetType: event.target.value as ScenarioRuleInput["targetType"],
                        targetValue: "",
                      })
                    }
                  >
                    <option value="ticker">Ticker</option>
                    <option value="tag" disabled={tags.length === 0}>
                      Tag
                    </option>
                  </select>
                </label>

                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  {rule.targetType === "ticker" ? "Holding" : "Tag"}
                  <select
                    aria-label={`Adjustment ${index + 1} ${rule.targetType}`}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    value={rule.targetValue}
                    onChange={(event) => onUpdateRule(rule.id, { targetValue: event.target.value })}
                  >
                    <option value="">Choose {rule.targetType}</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  Change
                  <span className="relative mt-1 block">
                    <input
                      aria-label={`Adjustment ${index + 1} percentage change`}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-right font-mono text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                      inputMode="decimal"
                      min="-100"
                      onChange={(event) =>
                        onUpdateRule(rule.id, { changePercent: event.target.value })
                      }
                      placeholder="-10"
                      step="any"
                      type="number"
                      value={rule.changePercent}
                    />
                    <span aria-hidden="true" className="absolute top-1/2 right-3 -translate-y-1/2">
                      %
                    </span>
                  </span>
                </label>

                <Button
                  aria-label={`Remove adjustment ${index + 1}`}
                  className="size-10 w-full sm:w-10"
                  onClick={() => onRemoveRule(rule.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {evaluation.error && (
        <p className="mt-3 text-sm text-negative" role="alert">
          {evaluation.error}
        </p>
      )}

      {evaluation.result && (
        <div
          className="mt-4 rounded-lg border border-border bg-surface-elevated p-4"
          aria-live="polite"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Scenario portfolio value</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
                {formatCurrency(evaluation.result.scenarioValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Change from current</p>
              <p
                className={`mt-1 inline-flex items-center gap-1 text-lg font-semibold ${
                  evaluation.result.direction === "positive"
                    ? "text-positive"
                    : evaluation.result.direction === "negative"
                      ? "text-negative"
                      : "text-muted-foreground"
                }`}
              >
                {evaluation.result.direction === "positive" ? (
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                ) : evaluation.result.direction === "negative" ? (
                  <ArrowDownRight aria-hidden="true" className="size-4" />
                ) : null}
                <span>
                  {evaluation.result.direction === "positive" ? "+" : ""}
                  {formatCurrency(evaluation.result.absoluteChange)}
                </span>
                <span className="text-sm">
                  {evaluation.result.percentChange === null
                    ? "—"
                    : `${evaluation.result.direction === "positive" ? "+" : ""}${formatPercent(evaluation.result.percentChange)}`}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Allocation after scenario
            </h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {evaluation.result.allocationByPosition.map((position) => (
                <li
                  key={position.label}
                  className="flex min-w-0 items-center justify-between gap-3 text-xs"
                >
                  <span className="truncate text-foreground">{position.label}</span>
                  <span className="shrink-0 text-right text-muted-foreground">
                    {formatCurrency(position.value)} ·{" "}
                    {position.percent === null ? "—" : formatPercent(position.percent)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
