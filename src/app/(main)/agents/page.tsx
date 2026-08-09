"use client";
export default function AgentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-5">
        {[
          { name: "🎨 Creator Agent", status: "ONLINE", metrics: [{ label: "Pieces Created", value: "142" }, { label: "On-Brand Rate", value: "94.2%" }, { label: "Avg Gen Time", value: "3.2s" }] },
          { name: "📤 Publisher Agent", status: "ONLINE", metrics: [{ label: "Posts Published", value: "1,247" }, { label: "On-Time Rate", value: "100%" }, { label: "Channels", value: "4" }] },
          { name: "📊 Analyzer Agent", status: "ONLINE", metrics: [{ label: "Impressions Tracked", value: "2.4M" }, { label: "Forecast Accuracy", value: "94.2%" }, { label: "Attribution Rate", value: "34%" }] },
          { name: "🛡️ Guardian Agent", status: "ONLINE", metrics: [{ label: "Items Reviewed", value: "1,389" }, { label: "Pass Rate", value: "96.4%" }, { label: "Blocked Today", value: "3" }] },
        ].map((agent) => (
          <div key={agent.name} className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-aeon-teal" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="font-bold">{agent.name}</span>
              </div>
              <div className="w-10 h-6 bg-aeon-teal rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {agent.metrics.map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-xl font-black">{m.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-aeon-navy-1 font-mono text-[11px] text-muted-foreground space-y-1">
              <div><span className="text-aeon-navy-5">14:32:01</span> <span className="text-aeon-teal">Generated Twitter thread (score: 92/100)</span></div>
              <div><span className="text-aeon-navy-5">14:28:44</span> <span className="text-aeon-teal">A/B test variant B outperformed A by 18%</span></div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <h3 className="font-bold mb-4">🔌 MCP Server Status</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Twitter/X MCP", endpoint: "mcp://twitter.aeonprotocol.xyz", status: "connected" },
            { name: "LinkedIn MCP", endpoint: "mcp://linkedin.aeonprotocol.xyz", status: "connected" },
            { name: "Discord MCP", endpoint: "mcp://discord.aeonprotocol.xyz", status: "connected" },
            { name: "Mailchimp MCP", endpoint: "mcp://mailchimp.aeonprotocol.xyz", status: "connected" },
            { name: "AEON Telemetry MCP", endpoint: "mcp://telemetry.aeonprotocol.xyz", status: "connected" },
            { name: "GitHub MCP", endpoint: "mcp://github.aeonprotocol.xyz", status: "disconnected" },
          ].map((mcp) => (
            <div key={mcp.name} className={`flex items-center gap-3 p-3 rounded-lg border ${mcp.status === 'connected' ? 'border-emerald-500/20' : 'border-red-500/20 opacity-60'}`}>
              <span className={`text-lg ${mcp.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>●</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{mcp.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{mcp.endpoint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
