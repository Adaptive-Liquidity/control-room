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

interface ContextPayload {
  company: {
    name: string;
    pack: {
      promptCore?: {
        identity?: { oneLiner?: string };
        voice?: { tone?: string; dont?: string[] };
      };
    } | null;
    version?: number;
  };
  project: {
    name: string;
    pack: {
      promptCore?: {
        identity?: { oneLiner?: string; description?: string };
      };
    } | null;
    version?: number;
  };
}

function BrandVoicePanel({
  canCompany,
  canProject,
}: {
  canCompany: boolean;
  canProject: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<ContextPayload>({
    queryKey: ["context-packs"],
    queryFn: async () => {
      const res = await fetch("/api/context");
      if (!res.ok) throw new Error("Failed to load context packs");
      return res.json();
    },
  });

  const [companyOneLiner, setCompanyOneLiner] = useState("");
  const [voiceTone, setVoiceTone] = useState("");
  const [dontSay, setDontSay] = useState("");
  const [projectOneLiner, setProjectOneLiner] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!data) return;
    const voice = data.company.pack?.promptCore?.voice;
    const identity = data.company.pack?.promptCore?.identity;
    const projectIdentity = data.project.pack?.promptCore?.identity;
    setCompanyOneLiner(typeof identity?.oneLiner === "string" ? identity.oneLiner : "");
    setVoiceTone(typeof voice?.tone === "string" ? voice.tone : "");
    setDontSay(Array.isArray(voice?.dont) ? voice.dont.join(", ") : "");
    setProjectOneLiner(
      typeof projectIdentity?.oneLiner === "string" ? projectIdentity.oneLiner : ""
    );
    setDescription(
      typeof projectIdentity?.description === "string" ? projectIdentity.description : ""
    );
  }, [data]);

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to publish context pack");
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["context-packs"] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading brand voice…</p>;
  if (isError || !data) {
    return <p className="text-sm text-destructive">Failed to load context packs</p>;
  }

  return (
    <div className="max-w-lg space-y-8">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Company pack</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Voice and don&apos;t-say list used by every project. Publishing creates a new
            version {data.company.version ? `(current v${data.company.version})` : ""}.
          </p>
        </div>
        <div>
          <label htmlFor="company-oneliner" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Company one-liner
          </label>
          <input
            id="company-oneliner"
            className={inputClass}
            disabled={!canCompany || save.isPending}
            value={companyOneLiner}
            onChange={(e) => setCompanyOneLiner(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="voice-tone" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Voice tone
          </label>
          <input
            id="voice-tone"
            className={inputClass}
            disabled={!canCompany || save.isPending}
            value={voiceTone}
            onChange={(e) => setVoiceTone(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="dont-say" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Don&apos;t-say terms (comma-separated)
          </label>
          <input
            id="dont-say"
            className={inputClass}
            disabled={!canCompany || save.isPending}
            value={dontSay}
            onChange={(e) => setDontSay(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={!canCompany || save.isPending}
            onClick={() =>
              save.mutate({
                scope: "company",
                oneLiner: companyOneLiner,
                voiceTone,
                dontSay: dontSay
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            {save.isPending ? "Publishing…" : "Publish company pack"}
          </Button>
          {!canCompany && (
            <span className="text-xs text-muted-foreground">Requires ADMIN (company.manage)</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Project pack — {data.project.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Product-specific brief merged with the company pack for n8n.{" "}
            {data.project.version ? `Current v${data.project.version}.` : ""}
          </p>
        </div>
        <div>
          <label htmlFor="project-oneliner" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Project one-liner
          </label>
          <input
            id="project-oneliner"
            className={inputClass}
            disabled={!canProject || save.isPending}
            value={projectOneLiner}
            onChange={(e) => setProjectOneLiner(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="project-desc" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Description
          </label>
          <textarea
            id="project-desc"
            className={`${inputClass} h-24 py-2`}
            disabled={!canProject || save.isPending}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={!canProject || save.isPending}
            onClick={() =>
              save.mutate({
                scope: "project",
                oneLiner: projectOneLiner,
                description,
              })
            }
          >
            {save.isPending ? "Publishing…" : "Publish project pack"}
          </Button>
          {!canProject && (
            <span className="text-xs text-muted-foreground">Requires ADMIN or MANAGER</span>
          )}
        </div>
      </div>

      {save.isError && (
        <p className="text-xs text-destructive">
          {save.error instanceof Error ? save.error.message : "Publish failed"}
        </p>
      )}
      {save.isSuccess && !save.isError && (
        <p className="text-xs text-muted-foreground">Published new context version</p>
      )}

      <p className="text-xs text-muted-foreground">
        Guardian keyword rules stay separately seeded via{" "}
        <code className="font-mono">npm run db:seed-guardian</code>. Review outcomes on{" "}
        <a href="/audit" className="text-primary hover:underline">
          Audit
        </a>
        .
      </p>
    </div>
  );
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
  const canProject = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading: settingsLoading, isError: settingsError, error: settingsLoadError } = useQuery<{
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
    mutationFn: async ({
      fields,
      snapshot,
    }: {
      fields: Array<keyof SettingsForm>;
      snapshot: SettingsForm;
    }) => {
      for (const field of fields) {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: SETTING_KEYS[field], value: snapshot[field] }),
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

  const inputsDisabled = !canManage || save.isPending;

  function updateForm(patch: Partial<SettingsForm>) {
    setSaved(false);
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function saveRow(fields: Array<keyof SettingsForm>) {
    return (
      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          disabled={!canManage || !form || save.isPending}
          onClick={() => form && save.mutate({ fields, snapshot: form })}
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
            (settingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : settingsError ? (
              <p className="text-sm text-destructive">
                {settingsLoadError instanceof Error
                  ? settingsLoadError.message
                  : "Failed to load settings"}
              </p>
            ) : !form ? (
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
                    disabled={inputsDisabled}
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
                    disabled={inputsDisabled}
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
            <BrandVoicePanel canCompany={canManage} canProject={canProject} />
          )}

          {activeTab === "guardian" &&
            (settingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : settingsError ? (
              <p className="text-sm text-destructive">
                {settingsLoadError instanceof Error
                  ? settingsLoadError.message
                  : "Failed to load settings"}
              </p>
            ) : !form ? (
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
                      disabled={inputsDisabled}
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
                      disabled={inputsDisabled}
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
