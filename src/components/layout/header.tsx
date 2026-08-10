"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Operations overview" },
  "/agents": { title: "Agents", subtitle: "Creator, publisher, analyzer, guardian" },
  "/queue": { title: "Approval queue", subtitle: "Review and release content" },
  "/studio": { title: "Content studio", subtitle: "Draft with Guardian pre-flight" },
  "/calendar": { title: "Calendar", subtitle: "Publishing schedule" },
  "/attribution": { title: "Attribution", subtitle: "Content to outcome tracking" },
  "/analytics": { title: "Analytics", subtitle: "Channel performance" },
  "/ablab": { title: "A/B lab", subtitle: "Variant tests" },
  "/library": { title: "Library", subtitle: "Approved assets" },
  "/campaigns": { title: "Campaigns", subtitle: "Campaign orchestration" },
  "/team": { title: "Team", subtitle: "People and roles" },
  "/settings": { title: "Settings", subtitle: "Workspace configuration" },
};

export function Header() {
  const pathname = usePathname();
  const pageInfo = pageTitles[pathname] || { title: "AEON", subtitle: "" };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/90 px-6 backdrop-blur-sm">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight">{pageInfo.title}</h1>
        {pageInfo.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{pageInfo.subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
          <Link href="/studio">New content</Link>
        </Button>
        <Button asChild size="sm" className="h-8 text-xs font-medium">
          <Link href="/campaigns">New campaign</Link>
        </Button>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-semibold text-foreground">
          AC
        </div>
      </div>
    </header>
  );
}
