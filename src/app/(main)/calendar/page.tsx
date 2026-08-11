"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  channel?: string;
  status?: string;
  kind: "content" | "campaign";
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function channelDot(channel?: string): string {
  if (channel === "TWITTER") return "bg-primary";
  if (channel === "BLOG") return "bg-muted-foreground";
  if (channel === "EMAIL") return "bg-muted-foreground/50";
  return "bg-muted-foreground/70";
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const from = startOfMonth(cursor);
  const to = endOfMonth(cursor);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json() as Promise<{ events: CalendarEvent[]; campaigns: CalendarEvent[] }>;
    },
    refetchInterval: 30000,
  });

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of data?.events ?? []) {
      const day = new Date(e.date).getDate();
      const list = map.get(day) ?? [];
      list.push(e);
      map.set(day, list);
    }
    return map;
  }, [data]);

  const agenda = useMemo(
    () => Array.from(byDay.entries()).sort(([a], [b]) => a - b),
    [byDay]
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const label = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`pad-${i}`} className="aspect-square rounded-md border border-transparent" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const events = byDay.get(day) ?? [];
    cells.push(
      <div
        key={day}
        className={`aspect-square rounded-md border p-2 text-[11px] transition-colors ${
          events.length
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
            : "border-border bg-card hover:bg-secondary/50"
        }`}
      >
        <div className="font-medium">{day}</div>
        {events.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {events.slice(0, 3).map((e) => (
              <span
                key={e.id}
                title={`${e.title} (${e.channel ?? e.kind})`}
                className={`h-1.5 w-1.5 rounded-full ${channelDot(e.channel)}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Content calendar — {label}</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="mb-3 text-sm text-muted-foreground">Loading…</p>
          ) : null}
          <div className="mb-2 hidden grid-cols-7 gap-1 md:grid">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="hidden grid-cols-7 gap-1.5 md:grid" data-testid="calendar-grid">
            {cells}
          </div>
          <div data-testid="calendar-agenda" className="md:hidden">
            {!isLoading && agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled this month.</p>
            ) : (
              <div className="space-y-2">
                {agenda.map(([day, events]) => (
                  <div
                    key={day}
                    className="flex gap-3 rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                      <span className="text-sm font-semibold tabular-nums">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {events.map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-sm">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${channelDot(e.channel)}`}
                          />
                          <span className="truncate">{e.title}</span>
                          {e.status && (
                            <span className="ml-auto shrink-0 text-[10px] uppercase text-muted-foreground">
                              {e.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 hidden justify-center gap-4 md:flex">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" /> Twitter/X
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Blog
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Email
            </div>
          </div>
          {(data?.campaigns?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              Active campaign windows this month:{" "}
              {data!.campaigns.map((c) => c.title).join(", ")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
