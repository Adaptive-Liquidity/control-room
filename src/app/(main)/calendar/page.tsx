"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

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
  const [selectedDay, setSelectedDay] = useState<number | null>(() => new Date().getDate());

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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const label = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  const selectedEvents = selectedDay != null ? byDay.get(selectedDay) ?? [] : [];

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`pad-${i}`} className="aspect-square rounded-md border border-transparent" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const events = byDay.get(day) ?? [];
    const isSelected = selectedDay === day;
    cells.push(
      <button
        key={day}
        type="button"
        onClick={() => setSelectedDay(day)}
        className={cn(
          "aspect-square rounded-md border p-2 text-left text-[11px] transition-colors",
          events.length
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
            : "border-border bg-card hover:bg-secondary/50",
          isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
        aria-pressed={isSelected}
        aria-label={`${label} day ${day}, ${events.length} events`}
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
      </button>
    );
  }

  return (
    <div className="animate-fade-in grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Content calendar — {label}</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCursor(new Date(year, month - 1, 1));
                setSelectedDay(null);
              }}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCursor(new Date(year, month + 1, 1));
                setSelectedDay(null);
              }}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="mb-3 text-sm text-muted-foreground">Loading…</p> : null}
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
            {!isLoading && byDay.size === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                reason="No publish dates this month."
                action={{ label: "Open Studio", href: "/studio" }}
              />
            ) : (
              <div className="space-y-2">
                {Array.from(byDay.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([day, events]) => (
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
              Active campaign windows this month: {data!.campaigns.map((c) => c.title).join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>
            {selectedDay != null ? `${label} — day ${selectedDay}` : "Select a day"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDay == null ? (
            <p className="text-sm text-muted-foreground">Click a day on the calendar to see its agenda.</p>
          ) : selectedEvents.length === 0 ? (
            <EmptyState
              title="No events"
              reason={`Nothing scheduled on ${selectedDay} ${label}.`}
              action={{ label: "Draft content", href: "/studio" }}
            />
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-3 text-sm"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${channelDot(e.channel)}`} />
                  <div className="min-w-0">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.channel ?? e.kind}
                      {e.status ? ` · ${e.status}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
