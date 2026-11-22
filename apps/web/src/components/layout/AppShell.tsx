import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Briefcase, LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
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
  const dashboardActive = location.pathname === "/dashboard";
  const holdingsActive = location.pathname === "/holdings";

  const themeButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="h-8 px-2 text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4" />
      )}
      <span className="ml-2 hidden text-xs md:inline">
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </Button>
  );

  const signOutButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void onSignOut()}
      aria-label="Sign out"
      className="h-8 px-2 text-muted-foreground hover:text-destructive"
    >
      <LogOut aria-hidden="true" className="size-4" />
      <span className="ml-2 hidden text-xs md:inline">Sign out</span>
    </Button>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      <aside className="sticky top-0 z-30 flex h-auto w-full shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 md:h-screen md:w-60 md:justify-between md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-foreground">FolioAgent</span>
            </Link>
            <div className="flex items-center gap-1 md:hidden">
              {themeButton}
              {signOutButton}
            </div>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex items-center gap-1 md:w-full md:flex-col md:items-stretch"
          >
            <Link
              to="/dashboard"
              aria-current={dashboardActive ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                dashboardActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LayoutDashboard aria-hidden="true" className="size-4 shrink-0" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/holdings"
              aria-current={holdingsActive ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                holdingsActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Briefcase aria-hidden="true" className="size-4 shrink-0" />
              <span>Holdings</span>
            </Link>
          </nav>
        </div>

        <div className="hidden gap-3 border-t border-border pt-4 md:flex md:flex-col">
          <div className="flex min-w-0 flex-col px-3 py-1">
            <span className="truncate text-xs font-medium text-foreground">
              {session.user.email}
            </span>
            <span className="text-[11px] text-muted-foreground">Signed in</span>
          </div>
          <div className="flex items-center justify-between">
            {themeButton}
            {signOutButton}
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  );
}
