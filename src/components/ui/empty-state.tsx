import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  title: string;
  reason: string;
  action?: { label: string; href: string };
  className?: string;
}

export function EmptyState({ title, reason, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-secondary/20 px-4 py-6",
        className
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{reason}</p>
      {action && (
        <Button asChild size="sm" variant="outline" className="mt-1">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
