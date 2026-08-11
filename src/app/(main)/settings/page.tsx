"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";

const tabs = [
  { id: "health", label: "Integration Health" },
  { id: "general", label: "General" },
  { id: "brand", label: "Brand Voice" },
  { id: "guardian", label: "Guardian Rules" },
  { id: "agents", label: "Agent Config" },
  { id: "approval", label: "Approval Chain" },
];

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring sm:h-9";

interface HealthPayload {
  checkedAt: string;
  n8n: {
    ingressSecret: { configured: boolean };
    resumeSecret: { configured: boolean };
    bridgeEncryptionKey: { configured: boolean };
    lastDraftIngressAt: string | null;
    lastPublishReceiptAt: string | null;
    lastAgentRunAt: string | null;
    lastMetricIngestAt: string | null;
    draftsLast24h: number;
  };
  outbox: {
    pending: number;
    retry: number;
    failed: number;
    cronSecret: { configured: boolean };
  };
  pusher: { configured: boolean; detail?: string };
  storage: { configured: boolean; detail?: string };
}

function HealthCard({
  title,
  ok,
  detail,
}: {
  title: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-4">
      <StatusDot status={ok ? "online" : "error"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{title}</div>
          <Badge variant={ok ? "success" : "destructive"}>{ok ? "ready" : "missing"}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("health");
  const { data: health, isLoading } = useQuery<HealthPayload>({
    queryKey: ["integration-health"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/health");
      if (!res.ok) throw new Error("Failed to load health");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: activeTab === "health",
  });

  return (
    <div className="animate-fade-in">
      <div className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-hide sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors sm:px-5 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {activeTab === "health" && (
            <div className="space-y-3">
              {isLoading || !health ? (
                <p className="text-sm text-muted-foreground">Loading health…</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Checked {new Date(health.checkedAt).toLocaleString()} — secrets never returned
                  </p>
                  <div className="grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
                    <HealthCard
                      title="n8n ingress"
                      ok={health.n8n.ingressSecret.configured}
                      detail={`Drafts 24h: ${health.n8n.draftsLast24h} · last: ${
                        health.n8n.lastDraftIngressAt
                          ? new Date(health.n8n.lastDraftIngressAt).toLocaleString()
                          : "never"
                      }`}
                    />
                    <HealthCard
                      title="n8n resume / bridge"
                      ok={
                        health.n8n.resumeSecret.configured &&
                        health.n8n.bridgeEncryptionKey.configured
                      }
                      detail={`Receipt last: ${
                        health.n8n.lastPublishReceiptAt
                          ? new Date(health.n8n.lastPublishReceiptAt).toLocaleString()
                          : "never"
                      }`}
                    />
                    <HealthCard
                      title="Outbox drain"
                      ok={health.outbox.cronSecret.configured && health.outbox.failed === 0}
                      detail={`pending ${health.outbox.pending} · retry ${health.outbox.retry} · failed ${health.outbox.failed}`}
                    />
                    <HealthCard
                      title="Pusher"
                      ok={health.pusher.configured}
                      detail={health.pusher.detail || "—"}
                    />
                    <HealthCard
                      title="Object storage"
                      ok={health.storage.configured}
                      detail={health.storage.detail || "—"}
                    />
                    <HealthCard
                      title="Agent / metrics ingest"
                      ok={Boolean(health.n8n.lastAgentRunAt || health.n8n.lastMetricIngestAt)}
                      detail={`agent: ${
                        health.n8n.lastAgentRunAt
                          ? new Date(health.n8n.lastAgentRunAt).toLocaleString()
                          : "never"
                      } · metrics: ${
                        health.n8n.lastMetricIngestAt
                          ? new Date(health.n8n.lastMetricIngestAt).toLocaleString()
                          : "never"
                      }`}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "general" && (
            <div className="max-w-lg space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Organization Name
                </label>
                <input type="text" defaultValue="Adaptive Liquidity Labs" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Epoch Duration
                </label>
                <select className={inputClass}>
                  <option>24 hours (aligned with AEON Protocol)</option>
                  <option>12 hours</option>
                  <option>48 hours</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "brand" && (
            <div className="max-w-lg space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Forbidden Words
                </label>
                <textarea
                  defaultValue={`guaranteed yield\nstablecoin\nget rich\npassive income\nto the moon\n100% safe\nbuy AEON\nsoon\ncoming soon`}
                  className="min-h-[200px] w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {activeTab === "guardian" && (
            <div className="max-w-lg space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Sensitivity
                  </label>
                  <select className={inputClass} defaultValue="standard">
                    <option value="strict">Strict</option>
                    <option value="standard">Standard</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Auto-Block Threshold
                  </label>
                  <input type="number" defaultValue={60} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "agents" && (
            <div className="max-w-lg space-y-4">
              <p className="text-sm text-muted-foreground">
                LLM provider keys stay in n8n. Control Room stores only modelAlias / promptVersion on
                AgentRun telemetry.
              </p>
            </div>
          )}

          {activeTab === "approval" && (
            <div className="max-w-lg space-y-3">
              {[
                {
                  step: 1,
                  title: "Guardian Agent — Auto-Check",
                  desc: "Forbidden words, maturity bands, regulatory compliance",
                },
                {
                  step: 2,
                  title: "Human review — content.approve",
                  desc: "Revision-bound approve / reject / request-revision",
                },
                {
                  step: 3,
                  title: "Publish receipt",
                  desc: "PUBLISHED only via n8n publish receipt — never from UI alone",
                },
              ].map((step) => (
                <div
                  key={step.step}
                  className="flex items-center gap-4 rounded-md border border-border bg-secondary/50 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {step.step}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-xs text-muted-foreground sm:text-[11px]">{step.desc}</div>
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
