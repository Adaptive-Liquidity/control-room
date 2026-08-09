"use client";
import { useState } from "react";

const tabs = [
  { id: "general", label: "General" },
  { id: "brand", label: "Brand Voice" },
  { id: "guardian", label: "Guardian Rules" },
  { id: "agents", label: "Agent Config" },
  { id: "mcp", label: "MCP Servers" },
  { id: "approval", label: "Approval Chain" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="animate-fade-in">
      <div className="flex gap-1 border-b border-aeon-navy-3 mb-6">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab.id ? "text-aeon-teal border-aeon-teal" : "text-muted-foreground border-transparent hover:text-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        {activeTab === "general" && (
          <div className="space-y-4 max-w-lg">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-2">Organization Name</label><input type="text" defaultValue="Adaptive Liquidity Labs" className="w-full px-4 py-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 text-sm outline-none focus:border-aeon-teal transition-colors" /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-2">Epoch Duration</label><select className="w-full px-4 py-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 text-sm outline-none focus:border-aeon-teal"><option>24 hours (aligned with AEON Protocol)</option><option>12 hours</option><option>48 hours</option></select></div>
          </div>
        )}
        {activeTab === "brand" && (
          <div className="space-y-4 max-w-lg">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-2">Forbidden Words</label><textarea defaultValue={`guaranteed yield\nstablecoin\nget rich\npassive income\nto the moon\n100% safe\nbuy AEON\nsoon\ncoming soon`} className="w-full px-4 py-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 text-sm outline-none focus:border-aeon-teal min-h-[200px] resize-y" /></div>
          </div>
        )}
        {activeTab === "guardian" && (
          <div className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-2">Sensitivity</label><select className="w-full px-4 py-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 text-sm outline-none focus:border-aeon-teal"><option>Strict</option><option selected>Standard</option><option>Relaxed</option></select></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-2">Auto-Block Threshold</label><input type="number" defaultValue={60} className="w-full px-4 py-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 text-sm outline-none focus:border-aeon-teal" /></div>
            </div>
          </div>
        )}
        {activeTab === "agents" && (
          <div className="space-y-4 max-w-lg">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-2">Creator Agent — Model</label><select className="w-full px-4 py-3 rounded-lg bg-aeon-navy-1 border border-aeon-navy-3 text-sm outline-none focus:border-aeon-teal"><option selected>Claude 4 Sonnet (creative)</option><option>GPT-5</option><option>Gemini 2.5 Pro</option></select></div>
          </div>
        )}
        {activeTab === "mcp" && (
          <div className="grid grid-cols-2 gap-3 max-w-2xl">
            {[
              { name: "Twitter/X MCP", endpoint: "mcp://twitter.aeonprotocol.xyz", status: "connected" },
              { name: "LinkedIn MCP", endpoint: "mcp://linkedin.aeonprotocol.xyz", status: "connected" },
              { name: "Discord MCP", endpoint: "mcp://discord.aeonprotocol.xyz", status: "connected" },
              { name: "Mailchimp MCP", endpoint: "mcp://mailchimp.aeonprotocol.xyz", status: "connected" },
              { name: "AEON Telemetry MCP", endpoint: "mcp://telemetry.aeonprotocol.xyz", status: "connected" },
              { name: "GitHub MCP", endpoint: "mcp://github.aeonprotocol.xyz", status: "disconnected" },
            ].map((mcp) => (
              <div key={mcp.name} className={`flex items-center gap-3 p-4 rounded-lg border ${mcp.status === 'connected' ? 'border-emerald-500/20' : 'border-red-500/20 opacity-60'}`}>
                <span className={`text-lg ${mcp.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>●</span>
                <div><div className="text-sm font-bold">{mcp.name}</div><div className="text-[10px] text-muted-foreground font-mono">{mcp.endpoint}</div></div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "approval" && (
          <div className="max-w-lg space-y-3">
            {[
              { step: 1, title: "Guardian Agent — Auto-Check", desc: "Forbidden words, maturity bands, regulatory compliance", color: "bg-aeon-teal" },
              { step: 2, title: "Content Lead Review — Sarah Kim", desc: "Quality, tone, accuracy, brand voice", color: "bg-amber-500" },
              { step: 3, title: "Head of Marketing Approval — Alex Chen", desc: "Final sign-off, strategic alignment", color: "bg-emerald-500" },
            ].map((step) => (
              <div key={step.step} className="flex items-center gap-4 p-4 rounded-lg bg-aeon-navy-1">
                <div className={`w-9 h-9 rounded-full ${step.color} flex items-center justify-center text-aeon-navy-1 font-black text-sm`}>{step.step}</div>
                <div><div className="text-sm font-bold">{step.title}</div><div className="text-[11px] text-muted-foreground">{step.desc}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
