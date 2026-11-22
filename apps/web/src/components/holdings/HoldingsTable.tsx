import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Search, Trash2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { formatCurrency } from "@folioagent/shared";
import type { Editable, Holding, SortKey } from "@/hooks/useHoldings";
import { calculateCostBasis } from "@/lib/allocation";
import { selectionStore, useSelection } from "@/state/selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HoldingsTableProps {
  holdings: Holding[];
  loading: boolean;
  error?: string;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTag?: string | null;
  onSelectTag: (tag: string | null) => void;
  onEdit: (holding: Holding) => void;
  onDelete: (holding: Holding) => void;
  onInlineUpdate: (ticker: string, changes: Partial<Editable>) => Promise<void>;
  onRetry: () => void;
}

export function HoldingsTable({
  holdings,
  loading,
  error,
  sort,
  onSort,
  searchQuery,
  onSearchChange,
  selectedTag,
  onSelectTag,
  onEdit,
  onDelete,
  onInlineUpdate,
  onRetry,
}: HoldingsTableProps) {
  const shouldReduceMotion = useReducedMotion();
  const selectedSet = useSelection((s) => s.selectedSet);
  const currentTicker = useSelection((s) => s.selectedTicker);

  const [inlineEditing, setInlineEditing] = useState<{
    ticker: string;
    field: "shares" | "avg_cost" | "tags";
    value: string;
  } | null>(null);

  const allSelected = holdings.length > 0 && holdings.every((h) => selectedSet.has(h.ticker));

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "ticker", label: "Ticker", align: "left" },
    { key: "shares", label: "Shares", align: "right" },
    { key: "avg_cost", label: "Avg cost", align: "right" },
    { key: "costBasis", label: "Cost basis", align: "right" },
    { key: "tags", label: "Tags", align: "left" },
  ];

  const commitInlineEdit = async () => {
    if (!inlineEditing) return;
    const { ticker, field, value } = inlineEditing;
    setInlineEditing(null);
    if (field === "tags") {
      const tags = value
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean);
      await onInlineUpdate(ticker, { tags });
    } else {
      await onInlineUpdate(ticker, { [field]: value });
    }
  };

  const renderedContent = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-2 p-4" aria-label="Loading holdings">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex h-12 items-center gap-4 border-b border-border/50 px-2 last:border-0"
            >
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-foreground">Holdings couldn't load</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      );
    }

    if (holdings.length === 0 && (searchQuery || selectedTag)) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No holdings found matching the current filters.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => onSearchChange("")}
              >
                Clear search
              </Button>
            )}
            {selectedTag && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => onSelectTag(null)}
              >
                Clear tag filter
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Desktop / Tablet Table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-card">
              <tr>
                <th className="h-11 w-10 px-3 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all holdings"
                    checked={allSelected}
                    onChange={() => selectionStore.selectAll(holdings.map((h) => h.ticker))}
                    className="size-4 rounded border-border text-primary focus:ring-ring"
                  />
                </th>
                {columns.map((col) => {
                  const isSorted = sort.key === col.key;
                  const ariaSortValue = isSorted
                    ? sort.desc
                      ? "descending"
                      : "ascending"
                    : "none";
                  return (
                    <th
                      key={col.key}
                      aria-sort={ariaSortValue}
                      className={`h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={`group inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                          col.align === "right" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <span>{col.label}</span>
                        <span className="text-muted-foreground/60 transition-colors group-hover:text-foreground">
                          {isSorted ? (
                            sort.desc ? (
                              <ArrowDown className="size-3.5 text-primary" />
                            ) : (
                              <ArrowUp className="size-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-100" />
                          )}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {holdings.map((holding) => {
                const costBasis = calculateCostBasis(holding.shares, holding.avg_cost);
                const isSelected = selectedSet.has(holding.ticker);
                const isCurrent = currentTicker === holding.ticker;

                return (
                  <motion.tr
                    layout={!shouldReduceMotion}
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    key={holding.ticker}
                    id={`holding-row-${holding.ticker}`}
                    tabIndex={0}
                    onClick={() => selectionStore.setSelectedTicker(holding.ticker)}
                    onMouseEnter={() => selectionStore.setHoveredTicker(holding.ticker)}
                    onMouseLeave={() => selectionStore.setHoveredTicker(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !inlineEditing) {
                        e.preventDefault();
                        setInlineEditing({
                          ticker: holding.ticker,
                          field: "shares",
                          value: holding.shares,
                        });
                      }
                    }}
                    className={`group h-12 cursor-pointer transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isCurrent
                        ? "bg-primary/10 ring-1 ring-inset ring-primary/40"
                        : isSelected
                          ? "bg-muted/50"
                          : ""
                    }`}
                  >
                    <td className="w-10 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${holding.ticker}`}
                        checked={isSelected}
                        onChange={() => selectionStore.toggleSelect(holding.ticker)}
                        className="size-4 rounded border-border text-primary focus:ring-ring"
                      />
                    </td>

                    <td className="px-4 font-semibold text-foreground">{holding.ticker}</td>

                    {/* Shares inline edit */}
                    <td
                      className="px-4 text-right tabular-nums text-foreground"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setInlineEditing({
                          ticker: holding.ticker,
                          field: "shares",
                          value: holding.shares,
                        });
                      }}
                    >
                      {inlineEditing?.ticker === holding.ticker &&
                      inlineEditing.field === "shares" ? (
                        <input
                          autoFocus
                          value={inlineEditing.value}
                          onChange={(e) =>
                            setInlineEditing({ ...inlineEditing, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitInlineEdit();
                            if (e.key === "Escape") setInlineEditing(null);
                          }}
                          onBlur={() => void commitInlineEdit()}
                          className="h-7 w-20 rounded border border-ring bg-background px-1 text-right text-xs tabular-nums text-foreground focus:outline-none"
                        />
                      ) : (
                        <span>{holding.shares}</span>
                      )}
                    </td>

                    {/* Avg cost inline edit */}
                    <td
                      className="px-4 text-right tabular-nums text-foreground"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setInlineEditing({
                          ticker: holding.ticker,
                          field: "avg_cost",
                          value: holding.avg_cost,
                        });
                      }}
                    >
                      {inlineEditing?.ticker === holding.ticker &&
                      inlineEditing.field === "avg_cost" ? (
                        <input
                          autoFocus
                          value={inlineEditing.value}
                          onChange={(e) =>
                            setInlineEditing({ ...inlineEditing, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitInlineEdit();
                            if (e.key === "Escape") setInlineEditing(null);
                          }}
                          onBlur={() => void commitInlineEdit()}
                          className="h-7 w-24 rounded border border-ring bg-background px-1 text-right text-xs tabular-nums text-foreground focus:outline-none"
                        />
                      ) : (
                        <span>{formatCurrency(holding.avg_cost)}</span>
                      )}
                    </td>

                    {/* Cost basis */}
                    <td className="px-4 text-right tabular-nums font-medium text-foreground">
                      {formatCurrency(costBasis.toFixed(2))}
                    </td>

                    {/* Tags inline edit & clickable pills */}
                    <td
                      className="px-4"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setInlineEditing({
                          ticker: holding.ticker,
                          field: "tags",
                          value: holding.tags.join("; "),
                        });
                      }}
                    >
                      {inlineEditing?.ticker === holding.ticker &&
                      inlineEditing.field === "tags" ? (
                        <input
                          autoFocus
                          value={inlineEditing.value}
                          onChange={(e) =>
                            setInlineEditing({ ...inlineEditing, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitInlineEdit();
                            if (e.key === "Escape") setInlineEditing(null);
                          }}
                          onBlur={() => void commitInlineEdit()}
                          className="h-7 w-full min-w-32 rounded border border-ring bg-background px-1.5 text-xs text-foreground focus:outline-none"
                        />
                      ) : holding.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {holding.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTag(selectedTag === tag ? null : tag);
                              }}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-normal transition-colors ${
                                selectedTag === tag
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={() => onEdit(holding)}
                              aria-label={`Edit ${holding.ticker}`}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Edit</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => onDelete(holding)}
                              aria-label={`Delete ${holding.ticker}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="divide-y divide-border/60 sm:hidden">
          {holdings.map((holding) => {
            const costBasis = calculateCostBasis(holding.shares, holding.avg_cost);
            const isSelected = selectedSet.has(holding.ticker);
            const isCurrent = currentTicker === holding.ticker;

            return (
              <div
                key={holding.ticker}
                id={`holding-mobile-${holding.ticker}`}
                onClick={() => selectionStore.setSelectedTicker(holding.ticker)}
                className={`p-4 transition-colors ${
                  isCurrent ? "bg-primary/10" : isSelected ? "bg-muted/50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${holding.ticker}`}
                      checked={isSelected}
                      onChange={() => selectionStore.toggleSelect(holding.ticker)}
                      className="size-4 rounded border-border text-primary focus:ring-ring"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <h3 className="font-semibold text-foreground">{holding.ticker}</h3>
                      {holding.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {holding.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTag(selectedTag === tag ? null : tag);
                              }}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ${
                                selectedTag === tag
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(holding)}
                      aria-label={`Edit ${holding.ticker}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(holding)}
                      aria-label={`Delete ${holding.ticker}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Shares</span>
                    <p className="mt-0.5 tabular-nums font-medium text-foreground">
                      {holding.shares}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg cost</span>
                    <p className="mt-0.5 tabular-nums font-medium text-foreground">
                      {formatCurrency(holding.avg_cost)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost basis</span>
                    <p className="mt-0.5 tabular-nums font-medium text-foreground">
                      {formatCurrency(costBasis.toFixed(2))}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }, [
    allSelected,
    columns,
    currentTicker,
    error,
    holdings,
    inlineEditing,
    loading,
    onDelete,
    onEdit,
    onRetry,
    onSearchChange,
    onSelectTag,
    onSort,
    searchQuery,
    selectedSet,
    selectedTag,
    shouldReduceMotion,
    sort,
  ]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-xl border border-border bg-card">
        {/* Search bar inside header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search ticker or tag… (/)"
                className="h-8 pl-8 text-xs"
                aria-label="Search holdings by ticker or tag"
              />
            </div>
            {selectedTag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Tag: {selectedTag}
                <button
                  type="button"
                  onClick={() => onSelectTag(null)}
                  className="rounded-full hover:bg-primary/20 p-0.5"
                  aria-label="Clear tag filter"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {holdings.length} {holdings.length === 1 ? "position" : "positions"}
          </span>
        </div>

        {renderedContent}
      </div>
    </TooltipProvider>
  );
}
