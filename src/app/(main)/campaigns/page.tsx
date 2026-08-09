"use client";
export default function CampaignsPage() {
  return (
    <div className="animate-fade-in">
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <h3 className="font-bold mb-4">🎯 Active Campaigns</h3>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-aeon-navy-3">
              <th className="text-left pb-2">Campaign</th><th className="text-left pb-2">Status</th><th className="text-left pb-2">Audience</th><th className="text-left pb-2">Content</th><th className="text-left pb-2">Scheduled</th><th className="text-left pb-2">Attributions</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "The Control Plane", status: "active", audience: "All Tiers", pieces: 24, scheduled: 12, attributions: 22 },
              { name: "Build Agents That Hold Money", status: "active", audience: "Tier 1", pieces: 18, scheduled: 8, attributions: 14 },
              { name: "Compliant By Architecture", status: "planning", audience: "Tier 4", pieces: 6, scheduled: 2, attributions: 3 },
              { name: "The Flywheel", status: "active", audience: "Tier 2", pieces: 15, scheduled: 10, attributions: 9 },
            ].map((c) => (
              <tr key={c.name} className="border-b border-aeon-navy-3/50">
                <td className="py-3 text-sm font-bold">{c.name}</td>
                <td className="py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{c.status}</span></td>
                <td className="py-3 text-sm text-muted-foreground">{c.audience}</td>
                <td className="py-3 text-sm">{c.pieces}</td>
                <td className="py-3 text-sm">{c.scheduled}</td>
                <td className="py-3 text-sm text-emerald-400 font-bold">{c.attributions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
