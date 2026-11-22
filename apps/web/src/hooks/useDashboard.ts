import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { DashboardHolding, DashboardPrice } from "@/lib/dashboard-calculations";

const API = (import.meta.env["VITE_API_URL"] ?? "http://localhost:4000").replace(/\/$/, "");

interface DashboardResponse {
  holdings: DashboardHolding[];
  prices: DashboardPrice[];
}

async function fetchAuthenticated<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

async function loadDashboard(token: string): Promise<DashboardResponse> {
  const [holdings, priceResponse] = await Promise.all([
    fetchAuthenticated<DashboardHolding[]>("/api/holdings", token),
    fetchAuthenticated<{ prices: DashboardPrice[] }>("/api/prices", token),
  ]);
  return {
    holdings,
    prices: priceResponse.prices,
  };
}

export function useDashboard(session: Session) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void loadDashboard(session.access_token)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "The dashboard could not load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey, session.access_token]);

  return { ...data, loading, error, refresh };
}
