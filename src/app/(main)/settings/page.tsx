"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";

const tabs = [
  { id: "general", label: "General" },
  { id: "brand", label: "Brand Voice" },
  { id: "guardian", label: "Guardian Rules" },
  { id: "agents", label: "Agent Config" },
  { id: "mcp", label: "MCP Servers" },
  { id: "approval", label: "Approval Chain" },
];

const inputClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {activeTab === "general" && (
            <div className="max-w-lg space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Organization Name</label>
                <input type="text" defaultValue="Adaptive Liquidity Labs" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Epoch Duration</label>
                <select className={inputClass}>
                  <option>24 hours (aligned with AEON Protocol)</option>
                  <option>12 hours</option>
                  <option>48 hours</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "brand" && (
            <div className="max-w-lg space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Forbidden Words</label>
                <textarea
                  defaultValue={`guaranteed yield\nstablecoin\nget rich\npassive income\nto the moon\n100% safe\nbuy AEON\nsoon\ncoming soon`}
                  className="min-h-[200px] w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {activeTab === "guardian" && (
            <div className="max-w-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sensitivity</label>
                  <select className={inputClass} defaultValue="standard">
                    <option value="strict">Strict</option>
                    <option value="standard">Standard</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Auto-Block Threshold</label>
                  <input type="number" defaultValue={60} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "agents" && (
            <div className="max-w-lg space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Creator Agent — Model</label>
                <select className={inputClass} defaultValue="claude">
                  <option value="claude">Claude 4 Sonnet (creative)</option>
                  <option value="gpt">GPT-5</option>
                  <option value="gemini">Gemini 2.5 Pro</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "mcp" && (
            <div className="grid max-w-2xl grid-cols-2 gap-3">
              {[
                { name: "Twitter/X MCP", endpoint: "mcp://twitter.aeonprotocol.xyz", status: "connected" as const },
                { name: "LinkedIn MCP", endpoint: "mcp://linkedin.aeonprotocol.xyz", status: "connected" as const },
                { name: "Discord MCP", endpoint: "mcp://discord.aeonprotocol.xyz", status: "connected" as const },
                { name: "Mailchimp MCP", endpoint: "mcp://mailchimp.aeonprotocol.xyz", status: "connected" as const },
                { name: "AEON Telemetry MCP", endpoint: "mcp://telemetry.aeonprotocol.xyz", status: "connected" as const },
                { name: "GitHub MCP", endpoint: "mcp://github.aeonprotocol.xyz", status: "disconnected" as const },
              ].map((mcp) => (
                <div
                  key={mcp.name}
                  className={`flex items-center gap-3 rounded-md border p-4 ${
                    mcp.status === "connected" ? "border-border" : "border-border opacity-60"
                  }`}
                >
                  <StatusDot status={mcp.status === "connected" ? "online" : "error"} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{mcp.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{mcp.endpoint}</div>
                  </div>
                  <Badge variant={mcp.status === "connected" ? "success" : "destructive"}>{mcp.status}</Badge>
                </div>
              ))}
            </div>
          )}

          {activeTab === "approval" && (
            <div className="max-w-lg space-y-3">
              {[
                { step: 1, title: "Guardian Agent — Auto-Check", desc: "Forbidden words, maturity bands, regulatory compliance" },
                { step: 2, title: "Content Lead Review — Sarah Kim", desc: "Quality, tone, accuracy, brand voice" },
                { step: 3, title: "Head of Marketing Approval — Alex Chen", desc: "Final sign-off, strategic alignment" },
              ].map((step) => (
                <div key={step.step} className="flex items-center gap-4 rounded-md border border-border bg-secondary/50 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {step.step}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-[11px] text-muted-foreground">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
