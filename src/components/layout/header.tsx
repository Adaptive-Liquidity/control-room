"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Real-time marketing operations & agent telemetry" },
  "/agents": { title: "Agent Squad", subtitle: "4-agent collaborative squad with shared memory" },
  "/queue": { title: "Approval Queue", subtitle: "Multi-step approval workflow with Guardian checks" },
  "/studio": { title: "Content Studio", subtitle: "AI-assisted content creation with pre-flight compliance" },
  "/calendar": { title: "Content Calendar", subtitle: "Epoch-aligned publishing schedule" },
  "/attribution": { title: "Attribution", subtitle: "Closed-loop content-to-treasury tracking" },
  "/analytics": { title: "Analytics", subtitle: "Cross-channel performance & predictive insights" },
  "/ablab": { title: "A/B Lab", subtitle: "Automated variant testing & optimization" },
  "/library": { title: "Content Library", subtitle: "Version-controlled asset repository" },
  "/campaigns": { title: "Campaigns", subtitle: "Goal-oriented campaign orchestration" },
  "/team": { title: "Team", subtitle: "Role-based access & permissions" },
  "/settings": { title: "Settings", subtitle: "Agent config, MCP servers, brand voice rules" },
};

export function Header() {
  const pathname = usePathname();
  const pageInfo = pageTitles[pathname] || { title: "AEON", subtitle: "" };

  return (
    <header className="h-[68px] bg-aeon-navy/80 backdrop-blur-xl border-b border-aeon-navy-3 sticky top-0 z-40 flex items-center justify-between px-7">
      <div>
        <h1 className="text-xl font-bold">{pageInfo.title}</h1>
        <p className="text-xs text-muted-foreground">{pageInfo.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="border-aeon-navy-4 bg-aeon-navy-2 hover:bg-aeon-navy-3">
          + New Content
        </Button>
        <Button size="sm" className="bg-gradient-to-r from-aeon-teal to-emerald-500 text-aeon-navy-1 font-bold hover:opacity-90">
          🚀 Launch Campaign
        </Button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-aeon-teal to-orange-500 flex items-center justify-center text-aeon-navy-1 font-bold text-sm">
          AC
        </div>
      </div>
    </header>
  );
}
