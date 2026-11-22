import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const requested = new URLSearchParams(window.location.search).get("theme");
    if (requested === "light" || requested === "dark") return requested;
    const saved = window.localStorage.getItem("folioagent-theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("theme");
    const saved = window.localStorage.getItem("folioagent-theme");
    const isDark = requested === "light" ? false : requested === "dark" ? true : saved !== "light";
    document.documentElement.classList.toggle("dark", isDark);
    setThemeState(isDark ? "dark" : "light");
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem("folioagent-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem("folioagent-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
