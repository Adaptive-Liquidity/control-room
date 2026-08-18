"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

const THEMES = [
  "CONTROL_PLANE",
  "BUILD_AGENTS",
  "COMPLIANT_ARCHITECTURE",
  "THE_FLYWHEEL",
  "CUSTOM",
] as const;

const AUDIENCES = [
  "TIER_1_AGENTS",
  "TIER_2_DEFI",
  "TIER_3_INFRASTRUCTURE",
  "TIER_4_ENTERPRISE",
  "ALL",
] as const;

const LAUNCH_ROLES = new Set(["ADMIN", "MANAGER"]);

const fieldClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring sm:h-9";

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  const { data: session } = useSession();
  const canLaunch = LAUNCH_ROLES.has(session?.user?.role ?? "");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("CONTROL_PLANE");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>("ALL");
  const [startDate, setStartDate] = useState(todayInputValue);
  const [endDate, setEndDate] = useState("");
  const [objective, setObjective] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

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

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          theme,
          audience,
          startDate: new Date(startDate).toISOString(),
          ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
          ...(objective.trim() ? { objective: objective.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Create failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowForm(false);
      setName("");
      setObjective("");
      setEndDate("");
      setCreateError(null);
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : "Create failed"),
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Campaigns</CardTitle>
          {canLaunch && (
            <Button
              size="sm"
              onClick={() => {
                setCreateError(null);
                setShowForm((v) => !v);
              }}
            >
              {showForm ? "Cancel" : "New campaign"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-5 space-y-3 rounded-md border border-border bg-secondary/30 p-4">
              <div>
                <label
                  htmlFor="campaign-name"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                >
                  Name
                </label>
                <input
                  id="campaign-name"
                  className={fieldClass}
                  placeholder="Q3 control plane push"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="campaign-theme"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                  >
                    Theme
                  </label>
                  <select
                    id="campaign-theme"
                    className={fieldClass}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as (typeof THEMES)[number])}
                  >
                    {THEMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="campaign-audience"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                  >
                    Audience
                  </label>
                  <select
                    id="campaign-audience"
                    className={fieldClass}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as (typeof AUDIENCES)[number])}
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="campaign-start"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                  >
                    Start date
                  </label>
                  <input
                    id="campaign-start"
                    type="date"
                    className={fieldClass}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="campaign-end"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                  >
                    End date (optional)
                  </label>
                  <input
                    id="campaign-end"
                    type="date"
                    className={fieldClass}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="campaign-objective"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                >
                  Objective (optional)
                </label>
                <textarea
                  id="campaign-objective"
                  className="min-h-[72px] w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  placeholder="What this campaign is trying to move"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  disabled={create.isPending || !name.trim() || !startDate}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? "Creating…" : "Create campaign"}
                </Button>
                {createError && <p className="text-xs text-destructive">{createError}</p>}
              </div>
            </div>
          )}

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
                        <div className="mt-1 text-xs text-muted-foreground sm:text-[10px]">auto-gen off</div>
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
