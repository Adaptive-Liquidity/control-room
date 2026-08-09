"use client";
export default function AbLabPage() {
  return (
    <div className="animate-fade-in">
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">🧪 Active A/B Tests</h3>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-aeon-teal to-emerald-500 text-aeon-navy-1 text-sm font-bold">+ New Test</button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-aeon-navy-3">
              <th className="text-left pb-2">Test</th><th className="text-left pb-2">Variants</th><th className="text-left pb-2">Channel</th><th className="text-left pb-2">Status</th><th className="text-left pb-2">Winner</th><th className="text-left pb-2">Lift</th><th className="text-left pb-2">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {[
              { test: "Thread Hook: Highways vs Traffic Lights", variants: "A / B", channel: "Twitter", status: "running", winner: "B (+18%)", lift: "+18%", confidence: "94%" },
              { test: "CTA: Explore vs View Telemetry", variants: "A / B / C", channel: "Blog", status: "running", winner: "C (+12%)", lift: "+12%", confidence: "89%" },
              { test: "Email Subject: Emoji vs No Emoji", variants: "A / B", channel: "Email", status: "complete", winner: "A (+8%)", lift: "+8%", confidence: "97%" },
              { test: "LinkedIn Tone: Technical vs Accessible", variants: "A / B", channel: "LinkedIn", status: "planning", winner: "—", lift: "—", confidence: "—" },
            ].map((row) => (
              <tr key={row.test} className="border-b border-aeon-navy-3/50">
                <td className="py-3 text-sm font-semibold">{row.test}</td>
                <td className="py-3 text-sm">{row.variants}</td>
                <td className="py-3 text-sm text-muted-foreground">{row.channel}</td>
                <td className="py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${row.status === 'running' ? 'bg-emerald-500/10 text-emerald-500' : row.status === 'complete' ? 'bg-aeon-teal/10 text-aeon-teal' : 'bg-amber-500/10 text-amber-500'}`}>{row.status}</span></td>
                <td className="py-3 text-sm">{row.winner}</td>
                <td className="py-3 text-sm text-emerald-400 font-bold">{row.lift}</td>
                <td className="py-3 text-sm">{row.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
