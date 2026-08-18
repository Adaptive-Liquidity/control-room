"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive, moreSections } from "./nav-data";

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const label = session?.user?.name || session?.user?.email || "Account";
  const role = session?.user?.role?.toLowerCase() || "signed in";
  const initials = (session?.user?.name || session?.user?.email || "A")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-border bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)]" aria-describedby={undefined}>
          <div className="flex h-12 items-center justify-between border-b border-border/70 px-4">
            <Dialog.Title className="text-[14px] font-semibold tracking-tight text-foreground/90">
              Menu
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground/80"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </Dialog.Close>
          </div>

          <nav className="px-1.5 py-2">
            {moreSections.map((section) => (
              <div key={section.title} className="mb-1.5">
                <div className="px-2.5 pb-1 pt-2.5 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground/70">
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
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex min-h-[44px] items-center gap-3 rounded-[6px] px-2.5 text-[14px] transition-colors",
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
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-muted-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground/80">{label}</div>
                <div className="truncate font-mono text-xs text-muted-foreground/70">{role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                void signOut({ callbackUrl: "/auth/signin" });
              }}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[6px] border border-border/70 px-2 text-[14px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground/80"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
