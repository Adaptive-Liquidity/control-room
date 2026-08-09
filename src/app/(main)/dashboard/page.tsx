"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DashboardData {
  stats: {
    pendingApprovals: number;
    scheduledPosts: number;
    publishedThisEpoch: number;
    activeAgents: number;
    guardianPassRate: number;
    contentToDevAttribution: number;
  };
  recentQueue: any[];
  upcoming: any[];
  agents: any[];
}

function StatCard({ label, value, delta, color }: { label: string; value: string | number; delta?: string; color?: string }) {
  return (
    <Card className="relative overflow-hidden border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${color || "bg-aeon-teal"}`} />
      <CardContent className="pt-5 pb-4">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">{label}</div>
        <div className="text-3xl font-black">{value}</div>
        {delta && <div className="text-xs text-emerald-400 font-bold mt-1">{delta}</div>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-aeon-navy-2 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Pending Approvals" value={stats?.pendingApprovals || 0} delta="↑ 2 from yesterday" color="bg-aeon-teal" />
        <StatCard label="Scheduled Posts" value={stats?.scheduledPosts || 0} delta="↑ 4 this week" color="bg-emerald-500" />
        <StatCard label="Published This Epoch" value={stats?.publishedThisEpoch || 0} delta="On target" color="bg-amber-500" />
        <StatCard label="Active Agents" value={`${stats?.activeAgents || 0}/4`} delta="All operational" color="bg-aeon-teal" />
        <StatCard label="Guardian Pass Rate" value={`${stats?.guardianPassRate || 0}%`} delta="↑ 1.2% vs last epoch" color="bg-emerald-500" />
        <StatCard label="Content→Dev Attribution" value={`${stats?.contentToDevAttribution || 0}%`} delta="↑ 8% this month" color="bg-orange-500" />
      </div>

      {/* Queue + Agents */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold">📥 Recent Approval Queue</CardTitle>
            <Badge variant="outline" className="border-aeon-navy-4 text-xs">View All</Badge>
          </CardHeader>
          <CardContent>
            {data?.recentQueue?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending items 🎉</p>
            ) : (
              <div className="space-y-3">
                {data?.recentQueue?.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 hover:border-aeon-navy-4 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-aeon-teal/10 flex items-center justify-center text-lg">📄</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground">{item.author?.name} • {item.channel}</div>
                    </div>
                    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                      {item.guardianScore}/100
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">🤖 Agent Telemetry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.agents?.map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${agent.status === 'ONLINE' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-500'}`} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{agent.name}</div>
                    <div className="text-[11px] text-muted-foreground">{agent.type} • {agent.status}</div>
                  </div>
                  {agent.mcpStatus === 'CONNECTED' && (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">MCP ✓</Badge>
                  )}
                </div>
              )) || (
                <>
                  <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" /><span className="text-sm">🎨 Creator — Operational</span></div>
                  <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" /><span className="text-sm">📤 Publisher — Operational</span></div>
                  <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" /><span className="text-sm">📊 Analyzer — Operational</span></div>
                  <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" /><span className="text-sm">🛡️ Guardian — Operational</span></div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Content */}
      <Card className="border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold">📅 Upcoming Content (Next 7 Epochs)</CardTitle>
          <Badge variant="outline" className="border-aeon-navy-4 text-xs">Full Calendar</Badge>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-aeon-navy-3">
                <th className="text-left pb-2">Epoch</th>
                <th className="text-left pb-2">Content</th>
                <th className="text-left pb-2">Channel</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-left pb-2">Agent</th>
                <th className="text-left pb-2">Guardian</th>
              </tr>
            </thead>
            <tbody>
              {(data?.upcoming || []).map((item: any) => (
                <tr key={item.id} className="border-b border-aeon-navy-3/50 hover:bg-aeon-teal/5 transition-colors">
                  <td className="py-3 text-sm font-mono text-aeon-teal">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString() : 'TBD'}</td>
                  <td className="py-3 text-sm font-semibold">{item.title}</td>
                  <td className="py-3 text-sm text-muted-foreground">{item.channel}</td>
                  <td className="py-3">
                    <Badge className={`text-[10px] ${
                      item.status === 'SCHEDULED' ? 'bg-aeon-teal/10 text-aeon-teal border-aeon-teal/20' :
                      item.status === 'PENDING_REVIEW' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{item.type === 'EMAIL' ? 'Publisher' : 'Creator'}</td>
                  <td className="py-3 text-sm text-muted-foreground">{item.guardianScore >= 95 ? 'Auto' : 'Pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Attribution Funnel */}
      <Card className="border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">🔗 Closed-Loop Attribution Funnel</CardTitle>
          <p className="text-xs text-muted-foreground">Content → Engagement → Signup → Integration → Treasury</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-0">
            {[
              { stage: "Content Views", count: "12.4K", rate: "100%", color: "from-aeon-navy-3 to-aeon-navy-4" },
              { stage: "Engagements", count: "3.1K", rate: "25.0%", color: "from-aeon-navy-4 to-aeon-navy-5" },
              { stage: "Doc Clicks", count: "420", rate: "13.5%", color: "from-aeon-navy-5 to-[#3d5a80]" },
              { stage: "Testnet Signups", count: "68", rate: "16.2%", color: "from-[#3d5a80] to-aeon-teal/20" },
              { stage: "Integrations", count: "23", rate: "33.8%", color: "from-aeon-teal/20 to-aeon-teal/30" },
            ].map((step, i) => (
              <div key={i} className={`flex-1 py-5 px-4 text-center bg-gradient-to-r ${step.color} ${i < 4 ? 'clip-path-funnel' : ''}`} style={{ clipPath: i < 4 ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)' : 'none' }}>
                <div className="text-2xl font-black text-white">{step.count}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{step.stage}</div>
                <div className="text-xs text-aeon-teal font-bold mt-1">{step.rate}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-6 mt-4 justify-center text-xs text-muted-foreground">
            <span><strong className="text-aeon-teal">Top Driver:</strong> "Build Agents That Hold Money" thread — 14 integrations</span>
            <span><strong className="text-aeon-teal">Top Channel:</strong> Twitter/X — 58% of attributed signups</span>
            <span><strong className="text-aeon-teal">Top Campaign:</strong> The Control Plane — 22 integrations</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
