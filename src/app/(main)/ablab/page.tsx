"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

interface ExperimentRow {
  id: string;
  name: string;
  hypothesis: string;
  channel: string | null;
  status: string;
  variants: Array<{ id: string; name: string }>;
  primaryMetric: string;
  outcome: string | null;
  decision: string | null;
  liftPct: number | null;
  confidencePct: number | null;
}

function statusVariant(status: string): "success" | "secondary" | "warning" | "destructive" {
  if (status === "RUNNING") return "success";
  if (status === "COMPLETE") return "secondary";
  if (status === "CANCELLED") return "destructive";
  return "warning";
}

export default function AbLabPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [channel, setChannel] = useState("TWITTER");
  const [primaryMetric, setPrimaryMetric] = useState("engagement_rate");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: ExperimentRow[] }>({
    queryKey: ["experiments"],
    queryFn: async () => {
      const res = await fetch("/api/experiments");
      if (!res.ok) throw new Error("Failed to load experiments");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          hypothesis,
          channel,
          primaryMetric,
          variants: [
            { id: "A", name: "Control" },
            { id: "B", name: "Variant B" },
          ],
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
      setHypothesis("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["experiments"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Create failed"),
  });

  return (
    <div className="animate-fade-in space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>A/B Lab</CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New Test"}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-5 space-y-3 rounded-md border border-border bg-secondary/30 p-4">
              <input
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                placeholder="Test name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                placeholder="Hypothesis"
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <select
                  className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {["TWITTER", "LINKEDIN", "DISCORD", "EMAIL", "BLOG"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm"
                  placeholder="Primary metric"
                  value={primaryMetric}
                  onChange={(e) => setPrimaryMetric(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={create.isPending || !name.trim() || !hypothesis.trim()}
                  onClick={() => void create.mutateAsync()}
                >
                  Create
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.items?.length ? (
            <p className="text-sm text-muted-foreground">
              No experiments yet. Confidence and lift stay empty until results are recorded.
            </p>
          ) : (
<ResponsiveTable
              rows={data.items}
              rowKey={(row) => row.id}
              columns={[
                { key: "test", header: "Test", cell: (row) => <span className="font-medium">{row.name}</span> },
                {
                  key: "variants",
                  header: "Variants",
                  cell: (row) =>
                    Array.isArray(row.variants)
                      ? row.variants.map((v) => v.name || v.id).join(" / ")
                      : "—",
                },
                { key: "channel", header: "Channel", cell: (row) => <span className="text-muted-foreground">{row.channel ?? "—"}</span> },
                { key: "status", header: "Status", cell: (row) => <Badge variant={statusVariant(row.status)}>{row.status.toLowerCase()}</Badge> },
                { key: "winner", header: "Winner", cell: (row) => row.outcome ?? "—" },
                { key: "lift", header: "Lift", cell: (row) => <span className="font-medium">{row.liftPct != null ? `${row.liftPct > 0 ? "+" : ""}${row.liftPct}%` : "—"}</span> },
                { key: "confidence", header: "Confidence", cell: (row) => (row.confidencePct != null ? `${row.confidencePct}%` : "—") },
              ]}
              card={{
                title: (row) => row.name,
                badge: (row) => <Badge variant={statusVariant(row.status)}>{row.status.toLowerCase()}</Badge>,
                fields: [
                  {
                    label: "Variants",
                    value: (row) =>
                      Array.isArray(row.variants)
                        ? row.variants.map((v) => v.name || v.id).join(" / ")
                        : "—",
                  },
                  { label: "Channel", value: (row) => row.channel ?? "—" },
                  { label: "Winner", value: (row) => row.outcome ?? "—" },
                  { label: "Lift", value: (row) => (row.liftPct != null ? `${row.liftPct > 0 ? "+" : ""}${row.liftPct}%` : "—") },
                  { label: "Confidence", value: (row) => (row.confidencePct != null ? `${row.confidencePct}%` : "—") },
                ],
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
