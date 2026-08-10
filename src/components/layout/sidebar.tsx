"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker,
  Bot,
  CalendarDays,
  FolderOpen,
  GitBranch,
  Inbox,
  LayoutDashboard,
  LineChart,
  PenLine,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections: {
  title: string;
  items: { icon: LucideIcon; label: string; href: string }[];
}[] = [
  {
    title: "Command",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Bot, label: "Agents", href: "/agents" },
      { icon: Inbox, label: "Queue", href: "/queue" },
      { icon: PenLine, label: "Studio", href: "/studio" },
      { icon: CalendarDays, label: "Calendar", href: "/calendar" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { icon: GitBranch, label: "Attribution", href: "/attribution" },
      { icon: LineChart, label: "Analytics", href: "/analytics" },
      { icon: Beaker, label: "A/B Lab", href: "/ablab" },
    ],
  },
  {
    title: "Operations",
    items: [
      { icon: FolderOpen, label: "Library", href: "/library" },
      { icon: Target, label: "Campaigns", href: "/campaigns" },
      { icon: Users, label: "Team", href: "/team" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
          A
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">AEON</div>
          <div className="truncate text-[11px] text-muted-foreground">Control Room</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={`${section.title}-${item.href}-${item.label}`}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                      isActive
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                      strokeWidth={1.75}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
