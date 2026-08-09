"use client";
export default function TeamPage() {
  return (
    <div className="animate-fade-in">
      <div className="p-6 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">👥 Team Members & Permissions</h3>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-aeon-teal to-emerald-500 text-aeon-navy-1 text-sm font-bold">+ Invite</button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-aeon-navy-3">
              <th className="text-left pb-2">Member</th><th className="text-left pb-2">Role</th><th className="text-left pb-2">Permissions</th><th className="text-left pb-2">Content</th><th className="text-left pb-2">Approval Rate</th><th className="text-left pb-2">Agent Access</th><th className="text-left pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Alex Chen", role: "Head of Marketing", perms: "Admin — All", content: 45, rate: "92%", agents: "All 4 Agents", status: "active" },
              { name: "Sarah Kim", role: "Content Lead", perms: "Create, Edit, Approve", content: 67, rate: "88%", agents: "Creator, Guardian", status: "active" },
              { name: "Marcus Johnson", role: "Social Media Manager", perms: "Create, Schedule", content: 34, rate: "85%", agents: "Creator, Publisher", status: "active" },
              { name: "Dr. Elena Rossi", role: "Technical Writer", perms: "Create, Edit", content: 12, rate: "96%", agents: "Creator, Guardian", status: "active" },
              { name: "James Wright", role: "Community Manager", perms: "Create, Moderate", content: 28, rate: "91%", agents: "Publisher, Analyzer", status: "away" },
            ].map((member) => (
              <tr key={member.name} className="border-b border-aeon-navy-3/50">
                <td className="py-3 text-sm font-bold">{member.name}</td>
                <td className="py-3 text-sm">{member.role}</td>
                <td className="py-3 text-sm text-muted-foreground">{member.perms}</td>
                <td className="py-3 text-sm">{member.content}</td>
                <td className="py-3 text-sm">{member.rate}</td>
                <td className="py-3 text-sm text-muted-foreground">{member.agents}</td>
                <td className="py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${member.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{member.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
