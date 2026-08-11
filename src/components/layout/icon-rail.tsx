"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive, navSections } from "./nav-data";

export function IconRail() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-14 flex-col border-r border-border bg-card md:flex lg:hidden">
      <div className="flex h-14 items-center justify-center border-b border-border/70">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary text-[12px] font-semibold tracking-tight text-foreground/90">
          A
        </div>
      </div>
      <nav aria-label="Primary" className="scrollbar-hide flex-1 overflow-y-auto px-1.5 py-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1.5">
            <div className="space-y-px">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={`${section.title}-${item.href}-${item.label}`}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-[6px] transition-colors",
                      isActive
                        ? "bg-secondary text-foreground/90"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground/80"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        isActive ? "text-foreground/90" : "text-muted-foreground/70"
                      )}
                      strokeWidth={1.75}
                    />
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
