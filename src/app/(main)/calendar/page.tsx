"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CalendarPage() {
  const days = [];
  for (let i = 1; i <= 31; i++) {
    const hasContent = [2, 5, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].includes(i);
    days.push(
      <div
        key={i}
        className={`aspect-square cursor-pointer rounded-md border p-2 text-[11px] transition-colors ${
          hasContent
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
            : "border-border bg-card hover:bg-secondary/50"
        }`}
      >
        <div className="font-medium">{i}</div>
        {hasContent && (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {i % 3 === 0 && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
            {i % 5 === 0 && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Epoch-Aligned Content Calendar — August 2026</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Prev</Button>
            <Button size="sm" variant="outline">Next</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <div key={d} className="py-1 text-center text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">{days}</div>
          <div className="mt-4 flex justify-center gap-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
