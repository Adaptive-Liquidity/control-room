import { cn } from "@/lib/utils";

export type StatusDotStatus =
  | "online"
  | "active"
  | "running"
  | "idle"
  | "paused"
  | "offline"
  | "complete"
  | "error";

const statusColor: Record<StatusDotStatus, string> = {
  online: "bg-success",
  active: "bg-success",
  running: "bg-success",
  paused: "bg-warning",
  idle: "bg-muted-foreground/40",
  complete: "bg-muted-foreground/40",
  offline: "bg-muted-foreground/20",
  error: "bg-destructive",
};

const liveStatuses: StatusDotStatus[] = ["online", "active", "running"];

export function StatusDot({
  status,
  className,
}: {
  status: StatusDotStatus;
  className?: string;
}) {
  const live = liveStatuses.includes(status);
  return (
    <span
      className={cn(
        "inline-block h-[7px] w-[7px] shrink-0 rounded-full",
        statusColor[status],
        live && "live-dot",
        className
      )}
    />
  );
}
