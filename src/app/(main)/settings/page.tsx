"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const EPOCH_OPTIONS = [
  { value: 24, label: "24 hours (aligned with AEON Protocol)" },
  { value: 12, label: "12 hours" },
  { value: 48, label: "48 hours" },
];

interface SettingsForm {
  orgName: string;
  epochDurationHours: number;
  guardianSensitivity: string;
  guardianAutoBlockThreshold: number;
}

const SETTING_KEYS: Record<keyof SettingsForm, string> = {
  orgName: "org.name",
  epochDurationHours: "org.epochDurationHours",
  guardianSensitivity: "guardian.sensitivity",
  guardianAutoBlockThreshold: "guardian.autoBlockThreshold",
};

const DEFAULT_FORM: SettingsForm = {
  orgName: "",
  epochDurationHours: 24,
  guardianSensitivity: "standard",
  guardianAutoBlockThreshold: 60,
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

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
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canManage = session?.user?.role === "ADMIN";

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<{
    settings: Record<string, unknown>;
  }>({
    queryKey: ["org-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (!settings) return;
    const map = settings.settings ?? {};
    setForm({
      orgName: asString(map[SETTING_KEYS.orgName], DEFAULT_FORM.orgName),
      epochDurationHours: asNumber(
        map[SETTING_KEYS.epochDurationHours],
        DEFAULT_FORM.epochDurationHours
      ),
      guardianSensitivity: asString(
        map[SETTING_KEYS.guardianSensitivity],
        DEFAULT_FORM.guardianSensitivity
      ),
      guardianAutoBlockThreshold: asNumber(
        map[SETTING_KEYS.guardianAutoBlockThreshold],
        DEFAULT_FORM.guardianAutoBlockThreshold
      ),
    });
  }, [settings]);

  const save = useMutation({
    mutationFn: async (fields: Array<keyof SettingsForm>) => {
      if (!form) throw new Error("Settings not loaded");
      for (const field of fields) {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: SETTING_KEYS[field], value: form[field] }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to save ${SETTING_KEYS[field]}`);
        }
      }
    },
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });

  function updateForm(patch: Partial<SettingsForm>) {
    setSaved(false);
    save.reset();
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function saveRow(fields: Array<keyof SettingsForm>) {
    return (
      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          disabled={!canManage || !form || save.isPending}
          onClick={() => save.mutate(fields)}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {saved && !save.isError && (
          <span className="text-xs text-muted-foreground">Saved</span>
        )}
        {save.isError && (
          <span className="text-xs text-destructive">
            {save.error instanceof Error ? save.error.message : "Save failed"}
          </span>
        )}
        {!canManage && (
          <span className="text-xs text-muted-foreground">
            Requires ADMIN (settings.manage)
          </span>
        )}
      </div>
    );
  }

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

          {activeTab === "general" &&
            (settingsLoading || !form ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : (
              <div className="max-w-lg space-y-4">
                <div>
                  <label
                    htmlFor="org-name"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Organization Name
                  </label>
                  <input
                    id="org-name"
                    type="text"
                    className={inputClass}
                    disabled={!canManage}
                    value={form.orgName}
                    onChange={(e) => updateForm({ orgName: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="epoch-duration"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Epoch Duration
                  </label>
                  <select
                    id="epoch-duration"
                    className={inputClass}
                    disabled={!canManage}
                    value={form.epochDurationHours}
                    onChange={(e) =>
                      updateForm({ epochDurationHours: Number(e.target.value) })
                    }
                  >
                    {EPOCH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {saveRow(["orgName", "epochDurationHours"])}
              </div>
            ))}

          {activeTab === "brand" && (
            <div className="max-w-lg space-y-3">
              <p className="text-sm text-muted-foreground">
                Brand voice rules (forbidden words, maturity bands, regulatory phrases) are
                Guardian rules stored in the database. They are provisioned by{" "}
                <code className="font-mono text-xs">npm run db:seed-guardian</code> and are not
                editable from Control Room — editing them here would bypass the policy version
                that every revision is checked against.
              </p>
              <p className="text-sm text-muted-foreground">
                Every Guardian evaluation is recorded with its policy version. Review outcomes on
                the{" "}
                <a href="/audit" className="text-primary hover:underline">
                  Audit
                </a>{" "}
                surface, or run a pre-flight check in{" "}
                <a href="/studio" className="text-primary hover:underline">
                  Studio
                </a>
                .
              </p>
            </div>
          )}

          {activeTab === "guardian" &&
            (settingsLoading || !form ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : (
              <div className="max-w-lg space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="guardian-sensitivity"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      Sensitivity
                    </label>
                    <select
                      id="guardian-sensitivity"
                      className={inputClass}
                      disabled={!canManage}
                      value={form.guardianSensitivity}
                      onChange={(e) => updateForm({ guardianSensitivity: e.target.value })}
                    >
                      <option value="strict">Strict</option>
                      <option value="standard">Standard</option>
                      <option value="relaxed">Relaxed</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="guardian-threshold"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      Auto-Block Threshold
                    </label>
                    <input
                      id="guardian-threshold"
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      disabled={!canManage}
                      value={form.guardianAutoBlockThreshold}
                      onChange={(e) =>
                        updateForm({ guardianAutoBlockThreshold: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                {saveRow(["guardianSensitivity", "guardianAutoBlockThreshold"])}
              </div>
            ))}

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
