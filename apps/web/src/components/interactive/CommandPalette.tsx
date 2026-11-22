import { useEffect } from "react";
import { Download, FileUp, HelpCircle, LogOut, Moon, Plus, Sun } from "lucide-react";
import { selectionStore, useSelection } from "@/state/selection";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function useShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCmdK) {
        event.preventDefault();
        selectionStore.setCommandOpen(!selectionStore.getState().commandOpen);
        return;
      }

      // Check if user is typing in an input element
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Check if a modal/sheet is currently open
      const hasOpenDialog =
        document.querySelector('[role="dialog"][data-state="open"]') !== null ||
        document.querySelector('[data-slot="sheet"][data-state="open"]') !== null;

      const state = selectionStore.getState();

      if (event.key === "?" && !isTyping) {
        event.preventDefault();
        selectionStore.setShortcutsOpen(!state.shortcutsOpen);
        return;
      }

      if (event.key === "Escape") {
        if (state.commandOpen) {
          selectionStore.setCommandOpen(false);
          return;
        }
        if (state.shortcutsOpen) {
          selectionStore.setShortcutsOpen(false);
          return;
        }
        if (state.selectedTicker) {
          selectionStore.setSelectedTicker(null);
          return;
        }
        if (state.selectedSet.size > 0) {
          selectionStore.clearSelection();
          return;
        }
      }

      // If typing or another dialog is open, do not execute single-letter shortcuts
      if (isTyping || hasOpenDialog || state.commandOpen || state.shortcutsOpen) {
        return;
      }

      const key = event.key;

      if (key === "n" || key === "N") {
        event.preventDefault();
        state.actions.onAdd?.();
      } else if (key === "/") {
        event.preventDefault();
        state.actions.onFocusSearch?.();
      } else if (key === "j" || key === "J") {
        event.preventDefault();
        selectionStore.moveSelection("down");
      } else if (key === "k" || key === "K") {
        event.preventDefault();
        selectionStore.moveSelection("up");
      } else if (key === "e" || key === "E") {
        if (state.selectedTicker) {
          event.preventDefault();
          state.actions.onEdit?.(state.selectedTicker);
        }
      } else if (key === "Delete" || key === "Backspace") {
        if (state.selectedTicker) {
          event.preventDefault();
          state.actions.onDelete?.(state.selectedTicker);
        }
      } else if (key === "t" || key === "T") {
        event.preventDefault();
        state.actions.onToggleTheme?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

export function CommandPalette() {
  useShortcuts();
  const open = useSelection((s) => s.commandOpen);
  const tickers = useSelection((s) => s.tickers);
  const actions = useSelection((s) => s.actions);

  const handleSelectTicker = (ticker: string) => {
    selectionStore.setCommandOpen(false);
    selectionStore.setSelectedTicker(ticker);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => selectionStore.setCommandOpen(isOpen)}
      title="FolioAgent Commands"
      description="Search commands or navigate tickers"
    >
      <CommandInput placeholder="Type a command or search tickers…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              selectionStore.setCommandOpen(false);
              actions.onAdd?.();
            }}
          >
            <Plus className="mr-2 size-4 text-primary" />
            <span>Add holding</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              selectionStore.setCommandOpen(false);
              actions.onImport?.();
            }}
          >
            <FileUp className="mr-2 size-4 text-muted-foreground" />
            <span>Import CSV</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              selectionStore.setCommandOpen(false);
              actions.onDownloadTemplate?.();
            }}
          >
            <Download className="mr-2 size-4 text-muted-foreground" />
            <span>Download CSV template</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              selectionStore.setCommandOpen(false);
              actions.onToggleTheme?.();
            }}
          >
            <Sun className="mr-2 size-4 text-muted-foreground dark:hidden" />
            <Moon className="mr-2 hidden size-4 text-muted-foreground dark:block" />
            <span>Toggle theme</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              selectionStore.setCommandOpen(false);
              selectionStore.setShortcutsOpen(true);
            }}
          >
            <HelpCircle className="mr-2 size-4 text-muted-foreground" />
            <span>Keyboard shortcuts help</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              selectionStore.setCommandOpen(false);
              actions.onSignOut?.();
            }}
          >
            <LogOut className="mr-2 size-4 text-destructive" />
            <span className="text-destructive">Sign out</span>
          </CommandItem>
        </CommandGroup>

        {tickers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Holdings">
              {tickers.map((ticker) => (
                <CommandItem key={ticker} onSelect={() => handleSelectTicker(ticker)}>
                  <span className="font-semibold">{ticker}</span>
                  <span className="ml-2 text-xs text-muted-foreground">Jump to position</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function ShortcutsHelp() {
  const open = useSelection((s) => s.shortcutsOpen);

  const shortcuts = [
    { key: "N", description: "Add new holding" },
    { key: "/", description: "Focus search input" },
    { key: "J / K", description: "Move row selection down / up" },
    { key: "E", description: "Edit selected holding" },
    { key: "Del", description: "Delete selected holding" },
    { key: "T", description: "Toggle light / dark theme" },
    { key: "⌘K / Ctrl+K", description: "Open command palette" },
    { key: "?", description: "Open keyboard shortcuts help" },
    { key: "Esc", description: "Dismiss overlay or clear selection" },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => selectionStore.setShortcutsOpen(isOpen)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Quick navigation and portfolio controls</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border/60 py-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">{description}</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
