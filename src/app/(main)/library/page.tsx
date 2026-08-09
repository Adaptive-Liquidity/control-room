"use client";
export default function LibraryPage() {
  const assets = [
    { icon: "🐦", title: "30-Day Twitter Content Calendar", desc: "Complete thread schedule with full copy", count: "30 posts" },
    { icon: "🌐", title: "Website Landing Page Copy", desc: "Full website copy for all 8 sections", count: "8 sections" },
    { icon: "📧", title: "Email Templates", desc: "Developer, institutional, newsletter templates", count: "3 templates" },
    { icon: "📰", title: "Press Release Templates", desc: "Testnet launch and partnership announcement", count: "2 releases" },
    { icon: "📢", title: "Ad Creative Briefs", desc: "Google Search, Display, social ad copy", count: "12 creatives" },
    { icon: "🎬", title: "Video Scripts", desc: "90s explainer, 60s AEGIS, 2min dev tutorial", count: "3 scripts" },
    { icon: "📊", title: "Pitch Deck Outline", desc: "13-slide investor presentation structure", count: "13 slides" },
    { icon: "📈", title: "Epoch Report Template", desc: "Auto-generated report structure", count: "10 sections" },
    { icon: "🎨", title: "Brand Messaging Guide", desc: "Voice, forbidden words, tiered pitches", count: "Full guide" },
    { icon: "🚨", title: "Crisis Communication Playbook", desc: "Response templates for 4 scenarios", count: "4 scenarios" },
    { icon: "🧪", title: "A/B Test Library", desc: "Historical test results and learnings", count: "24 tests" },
    { icon: "🛡️", title: "Guardian Rule Set", desc: "Forbidden words, compliance checks", count: "47 rules" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex gap-2 mb-5 flex-wrap">
        {["All Assets", "Twitter Threads", "Blog Posts", "Email Templates", "Press Releases", "Ad Creatives", "Video Scripts"].map((f, i) => (
          <button key={f} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${i === 0 ? "bg-aeon-teal/15 text-aeon-teal border border-aeon-teal/30" : "bg-aeon-navy-3 text-muted-foreground border border-aeon-navy-3 hover:border-aeon-navy-4"}`}>{f}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {assets.map((asset) => (
          <div key={asset.title} className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1 hover:border-aeon-navy-4 hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="text-3xl mb-3">{asset.icon}</div>
            <div className="font-bold text-sm mb-1">{asset.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{asset.desc}</div>
            <div className="mt-3 text-xs text-aeon-teal font-bold">{asset.count} →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
