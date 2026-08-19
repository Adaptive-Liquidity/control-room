"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuditItem {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; role: string } | null;
  agentId: string | null;
}

const TYPE_FILTERS = ["all", "APPROVAL", "CONTENT", "METRICS", "N8N", "GUARDIAN", "OTHER"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

function classifyType(type: string): TypeFilter {
  if (type.includes("APPROVAL") || type.includes("REJECT") || type.includes("REVISION")) return "APPROVAL";
  if (type.includes("CONTENT") || type.includes("DRAFT") || type.includes("PUBLISH")) return "CONTENT";
  if (type.includes("METRIC") || type.includes("ATTRIBUTION")) return "METRICS";
  if (type.includes("N8N") || type.includes("BRIDGE") || type.includes("OUTBOX")) return "N8N";
  if (type.includes("GUARDIAN")) return "GUARDIAN";
  return "OTHER";
}

function humanSentence(item: AuditItem): string {
  const who = item.user?.name || item.user?.email || (item.agentId ? `Agent ${item.agentId}` : "System");
  const meta = item.metadata ?? {};
  const decision = meta.decision ? ` (${String(meta.decision)})` : "";
  const contentId = meta.contentId ? ` for content ${String(meta.contentId).slice(0, 8)}…` : "";
  return `${who} — ${item.description}${decision}${contentId}`;
}

function metaBits(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const key of [
    "revisionId",
    "contentId",
    "contentHash",
    "decision",
    "guardianResult",
    "eventId",
    "runId",
  ]) {
    if (meta[key] != null) parts.push(`${key}=${String(meta[key])}`);
  }
  return parts.join(" · ");
}

export function AuditLogList({ items }: { items: AuditItem[] }) {
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered =
    filter === "all" ? items : items.filter((item) => classifyType(item.type) === filter);

  const toggleRaw = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {!filtered.length ? (
        <p className="text-sm text-muted-foreground">No entries match this filter.</p>
      ) : (
        <div className="space-y-0 divide-y divide-border">
          {filtered.map((item) => {
            const raw = metaBits(item.metadata);
            const isOpen = expanded.has(item.id);
            return (
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
                      {item.user?.name ||
                        item.user?.email ||
                        (item.agentId ? `agent:${item.agentId}` : "system")}
                    </span>
                  </div>
                  <div className="text-sm">{humanSentence(item)}</div>
                  {raw && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => toggleRaw(item.id)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide raw metadata" : "Show raw metadata"}
                      </button>
                      {isOpen && (
                        <div
                          className={cn(
                            "mt-1 break-all rounded-md border border-border bg-secondary/40 p-2 font-mono text-xs text-muted-foreground"
                          )}
                        >
                          {raw}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { AuditItem };
