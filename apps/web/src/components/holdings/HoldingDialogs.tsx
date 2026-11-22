import { useMemo, type FormEvent } from "react";
import { formatCurrency, formatPercent } from "@folioagent/shared";
import type { Holding } from "@/hooks/useHoldings";
import {
  calculateCostBasis,
  calculateTotalCostBasis,
  calculateAllocationPercent,
} from "@/lib/allocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface HoldingDialogsProps {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  editing: Holding | null;
  draft: { ticker: string; shares: string; avg_cost: string; tags: string };
  onDraftChange: (draft: {
    ticker: string;
    shares: string;
    avg_cost: string;
    tags: string;
  }) => void;
  formError?: string;
  busy: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  holdings: Holding[];

  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  holdingToDelete: Holding | null;
  onConfirmDelete: () => Promise<void>;
}

export function HoldingDialogs({
  sheetOpen,
  onSheetOpenChange,
  editing,
  draft,
  onDraftChange,
  formError,
  busy,
  onSave,
  holdings,
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  holdingToDelete,
  onConfirmDelete,
}: HoldingDialogsProps) {
  // Live calculation of draft basis and portfolio weight
  const { draftBasis, allocationFraction } = useMemo(() => {
    const basis = calculateCostBasis(draft.shares, draft.avg_cost);
    const otherHoldings = editing
      ? holdings.filter((h) => h.ticker.toUpperCase() !== editing.ticker.toUpperCase())
      : holdings;
    const currentOtherTotal = calculateTotalCostBasis(otherHoldings);
    const nextTotal = currentOtherTotal.plus(basis);
    const fraction = calculateAllocationPercent(basis, nextTotal);
    return { draftBasis: basis, allocationFraction: fraction };
  }, [draft.shares, draft.avg_cost, editing, holdings]);

  return (
    <>
      {/* Right-side Sheet for Add / Edit */}
      <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
        <SheetContent side="right" className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.ticker}` : "Add holding"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update your position shares, cost, or tags."
                : "Enter a ticker, share count, and purchase price to track."}
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={(e) => void onSave(e)}
            className="flex flex-1 flex-col justify-between py-4"
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground" htmlFor="holding-ticker">
                  Ticker
                </label>
                {editing ? (
                  <Input id="holding-ticker" className="mt-1.5" value={editing.ticker} disabled />
                ) : (
                  <Input
                    id="holding-ticker"
                    className="mt-1.5 uppercase"
                    autoFocus
                    placeholder="e.g. AAPL"
                    value={draft.ticker}
                    onChange={(e) =>
                      onDraftChange({ ...draft, ticker: e.target.value.toUpperCase() })
                    }
                    required
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground" htmlFor="holding-shares">
                  Shares
                </label>
                <Input
                  id="holding-shares"
                  className="mt-1.5 tabular-nums"
                  inputMode="decimal"
                  placeholder="e.g. 10"
                  value={draft.shares}
                  onChange={(e) => onDraftChange({ ...draft, shares: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground" htmlFor="holding-cost">
                  Average cost (USD)
                </label>
                <Input
                  id="holding-cost"
                  className="mt-1.5 tabular-nums"
                  inputMode="decimal"
                  placeholder="e.g. 150.00"
                  value={draft.avg_cost}
                  onChange={(e) => onDraftChange({ ...draft, avg_cost: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground" htmlFor="holding-tags">
                  Tags (semicolon-separated)
                </label>
                <Input
                  id="holding-tags"
                  className="mt-1.5"
                  placeholder="e.g. tech; growth; core"
                  value={draft.tags}
                  onChange={(e) => onDraftChange({ ...draft, tags: e.target.value })}
                />
              </div>

              {/* Live Preview Line */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Resulting cost basis</span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatCurrency(draftBasis.toFixed(2))}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-muted-foreground">
                  <span>Portfolio weight</span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatPercent(allocationFraction.toString())}
                  </span>
                </div>
              </div>

              {formError && (
                <p className="text-xs text-destructive" role="alert">
                  {formError}
                </p>
              )}
            </div>

            <SheetFooter className="mt-6 flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSheetOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "Add holding"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete holding</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">{holdingToDelete?.ticker}</span> from
              your holdings? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDeleteDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => void onConfirmDelete()}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
