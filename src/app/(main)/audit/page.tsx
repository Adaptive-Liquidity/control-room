"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AuditItem {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; role: string } | null;
  agentId: string | null;
}

function metaBits(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const key of ["revisionId", "contentId", "contentHash", "decision", "guardianResult", "eventId", "runId"]) {
    if (meta[key] != null) parts.push(`${key}=${String(meta[key])}`);
  }
  return parts.join(" · ");
}

export default function AuditPage() {
  const { data, isLoading } = useQuery<{ items: AuditItem[]; total: number }>({
    queryKey: ["audit"],
    queryFn: async () => {
      const res = await fetch("/api/audit?limit=100");
      if (!res.ok) throw new Error("Failed to load audit log");
      return res.json();
    },
    refetchInterval: 20000,
  });

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Audit console</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.items?.length ? (
            <p className="text-sm text-muted-foreground">No activity logged yet.</p>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
                >
                  <div className="shrink-0 font-mono text-xs text-muted-foreground sm:w-40 sm:text-[11px]">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{item.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.user?.name || item.user?.email || (item.agentId ? `agent:${item.agentId}` : "system")}
                      </span>
                    </div>
                    <div className="text-sm">{item.description}</div>
                    {metaBits(item.metadata) && (
                      <div className="mt-1 break-all font-mono text-xs text-muted-foreground sm:truncate sm:text-[10px]">
                        {metaBits(item.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
