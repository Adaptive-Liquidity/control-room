"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type TriageResult = {
  department: string;
  riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  approvalRequired: boolean;
  priorityScore: number;
  priority: "NOW" | "NEXT" | "LATER";
  nextAction: string;
  reasons: string[];
};

type TriageResponse = {
  projectId: string;
  intake: { request: string; urgency: number; impact: number; effort: number };
  triage: TriageResult;
};

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

function priorityVariant(priority: TriageResult["priority"]) {
  if (priority === "NOW") return "destructive" as const;
  if (priority === "NEXT") return "warning" as const;
  return "secondary" as const;
}

function riskVariant(risk: TriageResult["riskTier"]) {
  if (risk === "CRITICAL" || risk === "HIGH") return "destructive" as const;
  if (risk === "MEDIUM") return "warning" as const;
  return "success" as const;
}

function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex min-w-[7rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
      >
        {SCORE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function StaffPage() {
  const [request, setRequest] = useState("");
  const [urgency, setUrgency] = useState(3);
  const [impact, setImpact] = useState(3);
  const [effort, setEffort] = useState(3);
  const [result, setResult] = useState<TriageResponse | null>(null);

  const triage = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/chief-of-staff/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: request.trim(), urgency, impact, effort }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Triage failed (${res.status})`);
      }
      return data as TriageResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: data.triage.approvalRequired ? "Needs your approval" : "Triage ready",
        description: `${data.triage.priority} · ${data.triage.department.replace(/_/g, " ")}`,
        variant: data.triage.approvalRequired ? "destructive" : "success",
      });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Triage failed";
      toast({ title: "Triage failed", description: msg, variant: "destructive" });
    },
  });

  const t = result?.triage;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>What needs attention?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Describe the work in plain language. This only triages — it does not publish, spend,
            email anyone, or change production.
          </p>
          <Textarea
            aria-label="Request"
            placeholder="e.g. Research competitor positioning before the next campaign."
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            className="min-h-[140px]"
          />
          <div className="flex flex-wrap gap-3">
            <ScoreField id="urgency" label="Urgency" value={urgency} onChange={setUrgency} />
            <ScoreField id="impact" label="Impact" value={impact} onChange={setImpact} />
            <ScoreField id="effort" label="Effort" value={effort} onChange={setEffort} />
          </div>
          <Button
            disabled={triage.isPending || request.trim().length < 3}
            onClick={() => triage.mutate()}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {triage.isPending ? "Triaging…" : "Triage"}
          </Button>
        </CardContent>
      </Card>

      {t && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Recommendation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
              <Badge variant="outline">{t.department.replace(/_/g, " ")}</Badge>
              <Badge variant={riskVariant(t.riskTier)}>{t.riskTier} risk</Badge>
              {t.approvalRequired && <Badge variant="destructive">Approval required</Badge>}
            </div>
            {t.approvalRequired && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                High or critical risk. Do not execute until you approve. Nothing has been sent.
              </p>
            )}
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next action
              </div>
              <p className="text-sm leading-relaxed">{t.nextAction}</p>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {t.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
