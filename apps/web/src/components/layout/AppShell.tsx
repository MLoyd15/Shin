import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Briefcase, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { CommandPalette, ShortcutsHelp } from "@/components/interactive/CommandPalette";

interface AppShellProps {
  session: Session;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}

export function AppShell({ session, onSignOut, children }: AppShellProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      <aside className="sticky top-0 z-30 flex h-auto w-full shrink-0 flex-row items-center justify-between border-b border-border bg-card px-4 py-3 md:h-screen md:w-60 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-4 md:py-6">
        <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-6">
          <Link to="/holdings" className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-foreground">FolioAgent</span>
          </Link>

          <nav className="flex items-center gap-1 md:w-full md:flex-col md:items-stretch">
            <Link
              to="/holdings"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname === "/holdings"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Briefcase className="size-4 shrink-0" />
              <span>Holdings</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-3 md:border-t md:border-border md:pt-4">
          <div className="hidden flex-col px-3 py-1 md:flex">
            <span className="truncate text-xs font-medium text-foreground">
              {session.user.email}
            </span>
            <span className="text-[11px] text-muted-foreground">Signed in</span>
          </div>

          <div className="flex items-center gap-1.5 md:w-full md:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span className="hidden md:inline md:ml-2 text-xs">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onSignOut()}
              aria-label="Sign out"
              className="h-8 px-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
              <span className="hidden md:inline md:ml-2 text-xs">Sign out</span>
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  );
}
