"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditLogList, type AuditItem } from "@/components/audit/audit-log-list";

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
            <AuditLogList items={data.items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
