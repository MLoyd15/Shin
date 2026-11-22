import type { Holding } from "@/hooks/useHoldings";
import { calculateTotalCostBasis } from "@/lib/allocation";
import { formatCurrency } from "@folioagent/shared";
import { AnimatedNumber } from "@/components/interactive/effects";

export function SummaryStrip({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) return null;

  const totalCostBasis = calculateTotalCostBasis(holdings);

  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Positions</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          <AnimatedNumber value={holdings.length} />
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Total cost basis</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          <AnimatedNumber
            value={totalCostBasis.toNumber()}
            format={(val) => formatCurrency(val.toFixed(2))}
          />
        </p>
      </div>
    </div>
  );
}
