"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  "/audit": { title: "Audit", subtitle: "Policy and decision log" },
  "/team": { title: "Team", subtitle: "People and roles" },
  "/settings": { title: "Settings", subtitle: "Workspace configuration" },
};

export function Header() {
  const pathname = usePathname();
  const pageInfo = pageTitles[pathname] || { title: "AEON", subtitle: "" };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-7">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground/90">
          {pageInfo.title}
        </h1>
        {pageInfo.subtitle && (
          <p className="truncate text-[11px] text-muted-foreground">{pageInfo.subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
            <Link href="/studio">New content</Link>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs font-medium">
            <Link href="/campaigns">New campaign</Link>
          </Button>
        </div>
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Create new">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/studio">New content</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/campaigns">New campaign</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
