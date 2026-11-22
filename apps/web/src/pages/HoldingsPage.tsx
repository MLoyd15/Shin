import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { Download, FileUp, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SummaryStrip } from "@/components/holdings/SummaryStrip";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";
import { HoldingDialogs } from "@/components/holdings/HoldingDialogs";
import { ImportDialog } from "@/components/holdings/ImportDialog";
import { EmptyState } from "@/components/holdings/EmptyState";
import { BulkBar } from "@/components/holdings/BulkBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHoldings } from "@/hooks/useHoldings";
import { selectionStore } from "@/state/selection";
import { useTheme } from "@/lib/theme";

export function HoldingsPage({
  session,
  demoState,
}: {
  session: Session;
  demoState?: "empty" | "populated" | "import-errors";
}) {
  const { toggleTheme } = useTheme();

  const {
    holdings,
    filteredHoldings,
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
    bulkDelete,
    importDialogOpen,
    setImportDialogOpen,
    preview,
    setPreview,
    setRawCsv,
    importError,
    selectCsv,
    confirmImport,
    downloadTemplate,
    signOut,
  } = useHoldings({ session, demoState });

  // Sync tickers and global actions into selectionStore
  useEffect(() => {
    selectionStore.setTickers(holdings.map((h) => h.ticker));
  }, [holdings]);

  useEffect(() => {
    selectionStore.setActions({
      onAdd: beginAdd,
      onImport: () => setImportDialogOpen(true),
      onDownloadTemplate: () => void downloadTemplate(),
      onEdit: (ticker: string) => {
        const target = holdings.find((h) => h.ticker === ticker);
        if (target) beginEdit(target);
      },
      onDelete: (ticker: string) => {
        const target = holdings.find((h) => h.ticker === ticker);
        if (target) beginDelete(target);
      },
      onToggleTheme: toggleTheme,
      onSignOut: () => void signOut(),
      onFocusSearch: () => {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search holdings by ticker or tag"]',
        );
        if (input) {
          input.focus();
          input.select();
        }
      },
    });
  }, [
    beginAdd,
    beginDelete,
    beginEdit,
    downloadTemplate,
    holdings,
    setImportDialogOpen,
    signOut,
    toggleTheme,
  ]);

  return (
    <AppShell session={session} onSignOut={signOut}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Holdings
            </h1>
            {!loading && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {holdings.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                  <FileUp className="size-3.5" />
                  <span>Import / Template</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setImportDialogOpen(true)}
                  className="gap-2 text-xs"
                >
                  <FileUp className="size-3.5" />
                  <span>Import CSV…</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void downloadTemplate()} className="gap-2 text-xs">
                  <Download className="size-3.5" />
                  <span>Download template</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={beginAdd}>
              <Plus className="size-3.5" />
              <span>Add holding</span>
            </Button>
          </div>
        </div>

        {/* Summary Strip */}
        <SummaryStrip holdings={holdings} />

        {/* Hero Holdings Table or Empty State */}
        {!loading && holdings.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <EmptyState onAdd={beginAdd} onImport={() => setImportDialogOpen(true)} />
          </div>
        ) : (
          <HoldingsTable
            holdings={filteredHoldings}
            loading={loading}
            error={error}
            sort={sort}
            onSort={(key) =>
              setSort((current) => ({
                key,
                desc: current.key === key ? !current.desc : false,
              }))
            }
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            onEdit={beginEdit}
            onDelete={beginDelete}
            onInlineUpdate={updateHoldingOptimistic}
            onRetry={() => void refresh()}
          />
        )}

        {/* Bulk action floating bar */}
        <BulkBar onBulkDelete={bulkDelete} busy={busy} />

        {/* Dialogs & Sheets */}
        <HoldingDialogs
          sheetOpen={sheetOpen}
          onSheetOpenChange={setSheetOpen}
          editing={editing}
          draft={draft}
          onDraftChange={setDraft}
          formError={formError}
          busy={busy}
          onSave={saveHolding}
          holdings={holdings}
          deleteDialogOpen={deleteDialogOpen}
          onDeleteDialogOpenChange={setDeleteDialogOpen}
          holdingToDelete={holdingToDelete}
          onConfirmDelete={confirmDelete}
        />

        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          preview={preview}
          busy={busy}
          importError={importError}
          onSelectCsv={selectCsv}
          onConfirmImport={confirmImport}
          onCancelPreview={() => {
            setPreview(null);
            setRawCsv("");
          }}
        />
      </div>
    </AppShell>
  );
}
