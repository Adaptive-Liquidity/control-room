"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AgentsPage() {
  const agents = [
    { name: "Creator Agent", status: "ONLINE", metrics: [{ label: "Pieces Created", value: "142" }, { label: "On-Brand Rate", value: "94.2%" }, { label: "Avg Gen Time", value: "3.2s" }] },
    { name: "Publisher Agent", status: "ONLINE", metrics: [{ label: "Posts Published", value: "1,247" }, { label: "On-Time Rate", value: "100%" }, { label: "Channels", value: "4" }] },
    { name: "Analyzer Agent", status: "ONLINE", metrics: [{ label: "Impressions Tracked", value: "2.4M" }, { label: "Forecast Accuracy", value: "94.2%" }, { label: "Attribution Rate", value: "34%" }] },
    { name: "Guardian Agent", status: "ONLINE", metrics: [{ label: "Items Reviewed", value: "1,389" }, { label: "Pass Rate", value: "96.4%" }, { label: "Blocked Today", value: "3" }] },
  ];

  const mcpServers = [
    { name: "Twitter/X MCP", endpoint: "mcp://twitter.aeonprotocol.xyz", status: "connected" as const },
    { name: "LinkedIn MCP", endpoint: "mcp://linkedin.aeonprotocol.xyz", status: "connected" as const },
    { name: "Discord MCP", endpoint: "mcp://discord.aeonprotocol.xyz", status: "connected" as const },
    { name: "Mailchimp MCP", endpoint: "mcp://mailchimp.aeonprotocol.xyz", status: "connected" as const },
    { name: "AEON Telemetry MCP", endpoint: "mcp://telemetry.aeonprotocol.xyz", status: "connected" as const },
    { name: "GitHub MCP", endpoint: "mcp://github.aeonprotocol.xyz", status: "disconnected" as const },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent) => (
          <Card key={agent.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <CardTitle>{agent.name}</CardTitle>
              </div>
              <Badge variant="success">{agent.status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {agent.metrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
                    <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{m.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 rounded-md border border-border bg-secondary/50 p-3 font-mono text-[11px] text-muted-foreground">
                <div><span className="text-muted-foreground/70">14:32:01</span> Generated Twitter thread (score: 92/100)</div>
                <div><span className="text-muted-foreground/70">14:28:44</span> A/B test variant B outperformed A by 18%</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCP Server Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {mcpServers.map((mcp) => (
              <div
                key={mcp.name}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  mcp.status === "connected" ? "border-border" : "border-border opacity-60"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${mcp.status === "connected" ? "bg-emerald-600" : "bg-red-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{mcp.name}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">{mcp.endpoint}</div>
                </div>
                <Badge variant={mcp.status === "connected" ? "success" : "destructive"}>
                  {mcp.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
