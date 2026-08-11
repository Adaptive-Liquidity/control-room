"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive, primaryTabs } from "./nav-data";

export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();
  const moreActive = !primaryTabs.some((t) => isNavItemActive(pathname, t.href));

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex">
        {primaryTabs.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-foreground/90"
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="Open more navigation"
          className={cn(
            "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors",
            moreActive
              ? "text-foreground/90"
              : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
