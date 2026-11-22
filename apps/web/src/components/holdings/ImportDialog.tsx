import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Preview } from "@/hooks/useHoldings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: Preview | null;
  busy: boolean;
  importError?: string;
  onSelectCsv: (file?: File) => Promise<void>;
  onConfirmImport: () => Promise<void>;
  onCancelPreview: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  preview,
  busy,
  importError,
  onSelectCsv,
  onConfirmImport,
  onCancelPreview,
}: ImportDialogProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [isOverDropzone, setIsOverDropzone] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!open) {
      setIsWindowDragging(false);
      setIsOverDropzone(false);
      dragCounter.current = 0;
      return;
    }

    const handleWindowDragEnter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current += 1;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsWindowDragging(true);
      }
    };

    const handleWindowDragLeave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        setIsWindowDragging(false);
        dragCounter.current = 0;
      }
    };

    const handleWindowDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsWindowDragging(false);
      setIsOverDropzone(false);
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [open]);

  const handleDrop = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOverDropzone(false);
    setIsWindowDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onSelectCsv(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import holdings</DialogTitle>
          <DialogDescription>
            CSV supports ticker, shares, avg_cost, optional currency, and semicolon-separated tags.
            Up to 1 MiB · 500 rows.
          </DialogDescription>
        </DialogHeader>

        {isWindowDragging && !preview && (
          <div className="rounded-md bg-primary/10 px-3 py-1.5 text-center text-xs font-medium text-primary">
            Drop your CSV file here to start importing
          </div>
        )}

        {!preview ? (
          <div className="py-4">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOverDropzone(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOverDropzone(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOverDropzone(false);
              }}
              onDrop={(e) => void handleDrop(e)}
              className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all focus-within:ring-2 focus-within:ring-ring ${
                isOverDropzone
                  ? "border-primary bg-primary/10 shadow-lg scale-[1.01]"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {isOverDropzone ? (
                <UploadCloud className="size-8 text-primary animate-bounce" />
              ) : (
                <FileUp className="size-8 text-muted-foreground" />
              )}
              <span className="mt-2 text-sm font-medium text-foreground">
                {isOverDropzone ? "Drop CSV to preview" : "Drag and drop CSV here, or browse files"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">Up to 1 MiB</span>
              <input
                aria-label="Choose holdings CSV"
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onSelectCsv(e.target.files?.[0])}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {preview.willImport} will import, {preview.skipped} skipped
              </span>
              <span className="text-muted-foreground">{preview.rows.length} total rows parsed</span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left font-medium">Row</th>
                    <th className="p-2 text-left font-medium">Ticker</th>
                    <th className="p-2 text-right font-medium">Shares</th>
                    <th className="p-2 text-right font-medium">Avg cost</th>
                    <th className="p-2 text-left font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {preview.rows.map((row, index) => (
                    <motion.tr
                      key={row.rowNumber}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.3) }}
                      className="align-top"
                    >
                      <td className="p-2 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                      <td className="p-2 font-medium text-foreground">{row.values["ticker"]}</td>
                      <td className="p-2 text-right tabular-nums text-foreground">
                        {row.values["shares"]}
                      </td>
                      <td className="p-2 text-right tabular-nums text-foreground">
                        {row.values["avg_cost"]}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            row.status === "valid"
                              ? "font-medium text-positive"
                              : "font-medium text-negative"
                          }
                        >
                          {row.status === "valid" ? "Will import" : "Skipped"}
                        </span>
                        {row.errors.map((err, i) => (
                          <p key={i} className="mt-0.5 text-[11px] text-negative font-medium">
                            {err.field}: {err.reason}
                          </p>
                        ))}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importError && (
          <p className="text-xs text-destructive" role="alert">
            {importError}
          </p>
        )}

        <DialogFooter className="mt-2 flex flex-row justify-end gap-2">
          {preview ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onCancelPreview}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || preview.willImport === 0}
                onClick={() => void onConfirmImport()}
              >
                {busy ? "Importing…" : `Import ${preview.willImport} rows`}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
