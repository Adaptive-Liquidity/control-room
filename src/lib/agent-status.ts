/** Operator-facing agent status vocabulary — ONLINE / BUSY / OFFLINE only for live agents. */

export type AgentLiveStatus = "ONLINE" | "BUSY" | "OFFLINE" | "ERROR";

export function normalizeAgentStatus(status: string): AgentLiveStatus {
  if (status === "ONLINE" || status === "BUSY") return status;
  if (status === "ERROR") return "ERROR";
  return "OFFLINE";
}

export function agentStatusLabel(status: string): string {
  return normalizeAgentStatus(status);
}

export function agentStatusBadgeVariant(
  status: string
): "success" | "warning" | "destructive" | "secondary" {
  const normalized = normalizeAgentStatus(status);
  if (normalized === "ONLINE") return "success";
  if (normalized === "BUSY") return "warning";
  if (normalized === "ERROR") return "destructive";
  return "secondary";
}

export function agentStatusDot(status: string): "online" | "offline" | "error" {
  const normalized = normalizeAgentStatus(status);
  if (normalized === "ONLINE" || normalized === "BUSY") return "online";
  if (normalized === "ERROR") return "error";
  return "offline";
}

export function mcpStatusLabel(mcpStatus: string, mcpEndpoint?: string | null): string {
  if (mcpStatus === "CONNECTED") return "MCP connected";
  if (mcpEndpoint) return "MCP disconnected";
  return "MCP not configured";
}
