import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { selectionStore, useSelection } from "@/state/selection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BulkBarProps {
  onBulkDelete: (tickers: string[]) => Promise<void>;
  busy?: boolean;
}

export function BulkBar({ onBulkDelete, busy = false }: BulkBarProps) {
  const selectedSet = useSelection((s) => s.selectedSet);
  const count = selectedSet.size;
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (count === 0) return null;

  const handleConfirm = async () => {
    const tickers = Array.from(selectedSet);
    await onBulkDelete(tickers);
    setConfirmOpen(false);
    selectionStore.clearSelection();
  };

  return (
    <>
      <div
        className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card/95 px-5 py-2.5 shadow-lg backdrop-blur"
        role="status"
        aria-live="polite"
      >
        <span className="text-xs font-semibold text-foreground">
          {count} {count === 1 ? "holding" : "holdings"} selected
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => selectionStore.clearSelection()}
        >
          <X className="mr-1 size-3.5" />
          Clear
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <Trash2 className="mr-1 size-3.5" />
          Delete selected
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {count} holdings</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the selected {count} holdings? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              {busy ? "Deleting…" : `Delete ${count} holdings`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
