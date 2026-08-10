"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamPage() {
  const members = [
    { name: "Alex Chen", role: "Head of Marketing", perms: "Admin — All", content: 45, rate: "92%", agents: "All 4 Agents", status: "active" },
    { name: "Sarah Kim", role: "Content Lead", perms: "Create, Edit, Approve", content: 67, rate: "88%", agents: "Creator, Guardian", status: "active" },
    { name: "Marcus Johnson", role: "Social Media Manager", perms: "Create, Schedule", content: 34, rate: "85%", agents: "Creator, Publisher", status: "active" },
    { name: "Dr. Elena Rossi", role: "Technical Writer", perms: "Create, Edit", content: 12, rate: "96%", agents: "Creator, Guardian", status: "active" },
    { name: "James Wright", role: "Community Manager", perms: "Create, Moderate", content: 28, rate: "91%", agents: "Publisher, Analyzer", status: "away" },
  ];

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Team Members and Permissions</CardTitle>
          <Button size="sm">Invite</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Member</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Permissions</th>
                  <th className="pb-2 pr-4 font-medium">Content</th>
                  <th className="pb-2 pr-4 font-medium">Approval Rate</th>
                  <th className="pb-2 pr-4 font-medium">Agent Access</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.name} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium">{member.name}</td>
                    <td className="py-3 pr-4">{member.role}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{member.perms}</td>
                    <td className="py-3 pr-4">{member.content}</td>
                    <td className="py-3 pr-4">{member.rate}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{member.agents}</td>
                    <td className="py-3">
                      <Badge variant={member.status === "active" ? "success" : "warning"}>{member.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
