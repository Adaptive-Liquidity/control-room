"use client";
export default function AnalyticsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Impressions (30d)", value: "2.4M", delta: "↑ 18%", color: "text-white" },
          { label: "Cross-Channel Engagement", value: "4.2%", delta: "↑ 0.8%", color: "text-emerald-400" },
          { label: "Content Pieces (30d)", value: "156", delta: "↑ 24", color: "text-amber-400" },
          { label: "Approval Rate", value: "87%", delta: "↑ 5%", color: "text-aeon-teal" },
        ].map((stat) => (
          <div key={stat.label} className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</div>
            <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-emerald-400 font-bold mt-1">{stat.delta}</div>
          </div>
        ))}
      </div>
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <h3 className="font-bold mb-4">📊 Channel Performance Matrix</h3>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-aeon-navy-3">
              <th className="text-left pb-2">Channel</th><th className="text-left pb-2">Pieces</th><th className="text-left pb-2">Impressions</th><th className="text-left pb-2">Engagement</th><th className="text-left pb-2">Signups</th><th className="text-left pb-2">Top Performer</th>
            </tr>
          </thead>
          <tbody>
            {[
              { channel: "🐦 Twitter/X", pieces: 89, impressions: "1.8M", engagement: "4.8%", signups: 142, top: "The Control Plane thread — 45K" },
              { channel: "📝 Blog", pieces: 24, impressions: "320K", engagement: "3.2%", signups: 68, top: "Why Feedback Control Beats Fixed" },
              { channel: "📧 Email", pieces: 18, impressions: "180K", engagement: "22%", signups: 54, top: "Epoch Report #1,200" },
              { channel: "💼 LinkedIn", pieces: 12, impressions: "95K", engagement: "5.1%", signups: 24, top: "Compliant By Architecture" },
            ].map((row) => (
              <tr key={row.channel} className="border-b border-aeon-navy-3/50 hover:bg-aeon-teal/5 transition-colors">
                <td className="py-3 text-sm font-bold">{row.channel}</td>
                <td className="py-3 text-sm">{row.pieces}</td>
                <td className="py-3 text-sm text-muted-foreground">{row.impressions}</td>
                <td className="py-3 text-sm text-aeon-teal font-bold">{row.engagement}</td>
                <td className="py-3 text-sm">{row.signups}</td>
                <td className="py-3 text-sm text-muted-foreground">{row.top}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
