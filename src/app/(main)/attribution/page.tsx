"use client";
export default function AttributionPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Content→Signup Rate", value: "5.5%", delta: "↑ 1.2%", color: "text-aeon-teal" },
          { label: "Signup→Integration Rate", value: "33.8%", delta: "↑ 4.5%", color: "text-emerald-400" },
          { label: "Avg. Attribution Window", value: "4.2 days", delta: "Stable", color: "text-amber-400" },
        ].map((stat) => (
          <div key={stat.label} className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</div>
            <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-emerald-400 font-bold mt-1">{stat.delta}</div>
          </div>
        ))}
      </div>
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <h3 className="font-bold mb-4">🔗 Content → Treasury Impact</h3>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-aeon-navy-3">
              <th className="text-left pb-2">Content</th><th className="text-left pb-2">Views</th><th className="text-left pb-2">Signups</th><th className="text-left pb-2">Integrations</th><th className="text-left pb-2">Treasury Impact</th><th className="text-left pb-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {[
              { content: "Build Agents That Hold Money", views: "45.2K", signups: 89, integrations: 14, impact: "$2,340", roi: "12.4x" },
              { content: "The Control Plane Blog", views: "12.8K", signups: 34, integrations: 8, impact: "$1,560", roi: "8.7x" },
              { content: "Epoch Report Newsletter", views: "8.4K", signups: 22, integrations: 5, impact: "$890", roi: "6.2x" },
            ].map((row) => (
              <tr key={row.content} className="border-b border-aeon-navy-3/50">
                <td className="py-3 text-sm font-semibold">{row.content}</td>
                <td className="py-3 text-sm text-muted-foreground">{row.views}</td>
                <td className="py-3 text-sm">{row.signups}</td>
                <td className="py-3 text-sm">{row.integrations}</td>
                <td className="py-3 text-sm">{row.impact}</td>
                <td className="py-3 text-sm text-emerald-400 font-bold">{row.roi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
