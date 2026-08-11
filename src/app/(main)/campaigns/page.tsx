"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  audience: string;
  theme: string;
  paused: boolean;
  autoGenDisabled: boolean;
  emergencyStopped: boolean;
  pieceCount?: number;
  scheduledCount?: number;
  totalSignups: number;
  totalIntegrations: number;
  objective?: string | null;
  dailyContentLimit?: number | null;
}

function statusVariant(c: CampaignRow): "success" | "warning" | "destructive" | "secondary" {
  if (c.emergencyStopped) return "destructive";
  if (c.paused || c.status === "PAUSED") return "warning";
  if (c.status === "ACTIVE") return "success";
  return "secondary";
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: CampaignRow[] }>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to load campaigns");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const mutate = useMutation({
    mutationFn: async (opts: { id: string; action: "pause" | "resume" | "disable-auto-gen" | "enable-auto-gen" | "emergency-stop" }) => {
      if (opts.action === "pause" || opts.action === "resume") {
        const res = await fetch(`/api/campaigns/${opts.id}/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: opts.action === "pause" }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        return res.json();
      }
      if (opts.action === "disable-auto-gen" || opts.action === "enable-auto-gen") {
        const res = await fetch(`/api/campaigns/${opts.id}/disable-auto-gen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disabled: opts.action === "disable-auto-gen" }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        return res.json();
      }
      const res = await fetch(`/api/campaigns/${opts.id}/emergency-stop`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  function campaignControls(c: CampaignRow) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={mutate.isPending || c.emergencyStopped}
          onClick={() =>
            void mutate.mutateAsync({ id: c.id, action: c.paused ? "resume" : "pause" })
          }
        >
          {c.paused ? "Resume" : "Pause"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutate.isPending || c.emergencyStopped}
          onClick={() =>
            void mutate.mutateAsync({
              id: c.id,
              action: c.autoGenDisabled ? "enable-auto-gen" : "disable-auto-gen",
            })
          }
        >
          {c.autoGenDisabled ? "Enable gen" : "Disable gen"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={mutate.isPending || c.emergencyStopped}
          onClick={() => {
            if (confirm(`Emergency stop "${c.name}"?`)) {
              void mutate.mutateAsync({ id: c.id, action: "emergency-stop" });
            }
          }}
        >
          Stop
        </Button>
      </>
    );
  }

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.items?.length ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
<ResponsiveTable
              rows={data.items}
              rowKey={(c) => c.id}
              columns={[
                {
                  key: "campaign",
                  header: "Campaign",
                  cell: (c) => (
                    <>
                      <div className="font-medium">{c.name}</div>
                      {c.objective && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{c.objective}</div>
                      )}
                    </>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (c) => (
                    <>
                      <Badge variant={statusVariant(c)}>
                        {c.emergencyStopped ? "stopped" : c.paused ? "paused" : c.status.toLowerCase()}
                      </Badge>
                      {c.autoGenDisabled && (
                        <div className="mt-1 text-[10px] text-muted-foreground">auto-gen off</div>
                      )}
                    </>
                  ),
                },
                { key: "audience", header: "Audience", cell: (c) => <span className="text-muted-foreground">{c.audience}</span> },
                { key: "content", header: "Content", cell: (c) => c.pieceCount ?? 0 },
                { key: "scheduled", header: "Scheduled", cell: (c) => c.scheduledCount ?? 0 },
                { key: "attributions", header: "Attributions", cell: (c) => <span className="font-medium">{c.totalSignups + c.totalIntegrations}</span> },
                { key: "controls", header: "Controls", cell: (c) => <div className="flex flex-wrap gap-1.5">{campaignControls(c)}</div> },
              ]}
              card={{
                title: (c) => c.name,
                badge: (c) => (
                  <Badge variant={statusVariant(c)}>
                    {c.emergencyStopped ? "stopped" : c.paused ? "paused" : c.status.toLowerCase()}
                  </Badge>
                ),
                fields: [
                  { label: "Audience", value: (c) => c.audience },
                  { label: "Content", value: (c) => c.pieceCount ?? 0 },
                  { label: "Scheduled", value: (c) => c.scheduledCount ?? 0 },
                  { label: "Attributions", value: (c) => c.totalSignups + c.totalIntegrations },
                ],
                actions: (c) => campaignControls(c),
              }}
            />
          )}
          {mutate.isError && (
            <p className="mt-3 text-xs text-destructive">
              {mutate.error instanceof Error ? mutate.error.message : "Action failed"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
