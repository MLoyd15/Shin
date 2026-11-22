import { useSyncExternalStore } from "react";

export interface GlobalActions {
  onAdd?: () => void;
  onImport?: () => void;
  onDownloadTemplate?: () => void;
  onEdit?: (ticker: string) => void;
  onDelete?: (ticker: string) => void;
  onToggleTheme?: () => void;
  onSignOut?: () => void;
  onFocusSearch?: () => void;
}

export interface SelectionState {
  hoveredTicker: string | null;
  selectedTicker: string | null;
  selectedSet: Set<string>;
  tickers: string[];
  actions: GlobalActions;
  commandOpen: boolean;
  shortcutsOpen: boolean;
}

type Listener = () => void;

class SelectionStore {
  private state: SelectionState = {
    hoveredTicker: null,
    selectedTicker: null,
    selectedSet: new Set(),
    tickers: [],
    actions: {},
    commandOpen: false,
    shortcutsOpen: false,
  };
  private listeners: Set<Listener> = new Set();

  getState = (): SelectionState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify = () => {
    this.listeners.forEach((l) => l());
  };

  setHoveredTicker = (ticker: string | null) => {
    if (this.state.hoveredTicker === ticker) return;
    this.state = { ...this.state, hoveredTicker: ticker };
    this.notify();
  };

  setSelectedTicker = (ticker: string | null) => {
    if (this.state.selectedTicker === ticker) return;
    this.state = { ...this.state, selectedTicker: ticker };
    this.notify();
    if (ticker) {
      const el = document.getElementById(`holding-row-${ticker}`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  };

  toggleSelect = (ticker: string) => {
    const nextSet = new Set(this.state.selectedSet);
    if (nextSet.has(ticker)) {
      nextSet.delete(ticker);
    } else {
      nextSet.add(ticker);
    }
    this.state = { ...this.state, selectedSet: nextSet };
    this.notify();
  };

  selectAll = (tickers: string[]) => {
    const allSelected = tickers.length > 0 && tickers.every((t) => this.state.selectedSet.has(t));
    const nextSet = allSelected ? new Set<string>() : new Set(tickers);
    this.state = { ...this.state, selectedSet: nextSet };
    this.notify();
  };

  clearSelection = () => {
    if (this.state.selectedSet.size === 0) return;
    this.state = { ...this.state, selectedSet: new Set() };
    this.notify();
  };

  setTickers = (tickers: string[]) => {
    this.state = { ...this.state, tickers };
    this.notify();
  };

  setActions = (actions: GlobalActions) => {
    this.state = { ...this.state, actions: { ...this.state.actions, ...actions } };
    this.notify();
  };

  setCommandOpen = (open: boolean) => {
    if (this.state.commandOpen === open) return;
    this.state = { ...this.state, commandOpen: open };
    this.notify();
  };

  setShortcutsOpen = (open: boolean) => {
    if (this.state.shortcutsOpen === open) return;
    this.state = { ...this.state, shortcutsOpen: open };
    this.notify();
  };

  moveSelection = (direction: "up" | "down") => {
    const { tickers, selectedTicker } = this.state;
    if (tickers.length === 0) return;
    const currentIndex = selectedTicker ? tickers.indexOf(selectedTicker) : -1;
    let nextIndex: number;
    if (direction === "down") {
      nextIndex = currentIndex < tickers.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : tickers.length - 1;
    }
    this.setSelectedTicker(tickers[nextIndex] ?? null);
  };
}

export const selectionStore = new SelectionStore();

export function useSelection<T>(selector: (state: SelectionState) => T): T {
  return useSyncExternalStore(
    selectionStore.subscribe,
    () => selector(selectionStore.getState()),
    () => selector(selectionStore.getState()),
  );
}
