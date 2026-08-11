"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive, navSections } from "./nav-data";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[212px] flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-border/70 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary text-[12px] font-semibold tracking-tight text-foreground/90">
          A
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-foreground/90">AEON</div>
          <div className="truncate font-mono text-[10px] tracking-wide text-muted-foreground">Control Room</div>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-1.5 py-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1.5">
            <div className="px-2.5 pb-1 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground/70">
              {section.title}
            </div>
            <div className="space-y-px">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={`${section.title}-${item.href}-${item.label}`}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[6px] border-l-2 px-2.5 py-[6px] text-[12.5px] transition-colors",
                      isActive
                        ? "border-l-foreground/50 bg-secondary text-foreground/90"
                        : "border-l-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground/80"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[14px] w-[14px] shrink-0",
                        isActive ? "text-foreground/90" : "text-muted-foreground/70"
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

      <div className="flex items-center gap-2.5 border-t border-border/70 px-3.5 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-muted-foreground">
          AC
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-foreground/80">Account</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground/70">admin</div>
        </div>
      </div>
    </aside>
  );
}
