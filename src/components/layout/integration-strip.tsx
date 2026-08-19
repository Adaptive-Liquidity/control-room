"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

interface IntegrationHealth {
  pusher: { configured: boolean; detail?: string };
  storage: { configured: boolean; detail?: string };
}

export function IntegrationStrip() {
  const { data } = useQuery<IntegrationHealth>({
    queryKey: ["integration-health-strip"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/health");
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (!data) return null;

  const missing: string[] = [];
  if (!data.pusher?.configured) missing.push("Realtime (Pusher)");
  if (!data.storage?.configured) missing.push("Object storage");

  if (missing.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span>
        Missing integrations: <span className="font-medium text-foreground">{missing.join(", ")}</span>
        {" — "}
        polling fallback active; uploads may fail.
      </span>
      <Link href="/settings" className="font-medium text-primary hover:underline">
        Settings →
      </Link>
    </div>
  );
}
