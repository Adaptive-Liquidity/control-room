"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  _count: { contents: number; approvals: number };
}

const INVITE_ROLES = [
  "ADMIN",
  "MANAGER",
  "REVIEWER",
  "EDITOR",
  "VIEWER",
  "SERVICE",
] as const;

const inputClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring";

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>("EDITOR");
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ items: UserRow[] }>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (res.status === 403) {
        throw new Error("ADMIN settings.manage required to view team");
      }
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
          password,
          role,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Invite failed"
        );
      }
      return payload as { user: UserRow };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEmail("");
      setName("");
      setPassword("");
      setRole("EDITOR");
      setFormError(null);
      setOpen(false);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Invite failed");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    invite.mutate();
  }

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Team Members and Permissions</CardTitle>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              setFormError(null);
              setOpen((v) => !v);
            }}
          >
            {open ? "Cancel" : "Invite"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {open && (
            <form
              onSubmit={onSubmit}
              className="rounded-md border border-border p-4 space-y-3"
            >
              <div className="text-sm font-medium">Invite teammate</div>
              <p className="text-xs text-muted-foreground">
                Creates an account they can sign in with. Use role SERVICE for n8n
                system attribution.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">Email</span>
                  <input
                    className={inputClass}
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">Name (optional)</span>
                  <input
                    className={inputClass}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">Temporary password</span>
                  <input
                    className={inputClass}
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">Role</span>
                  <select
                    className={inputClass}
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as (typeof INVITE_ROLES)[number])
                    }
                  >
                    {INVITE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={invite.isPending}>
                  {invite.isPending ? "Creating…" : "Create account"}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unable to load users"}
            </p>
          ) : !data?.items?.length ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
<ResponsiveTable
              rows={data.items}
              rowKey={(member) => member.id}
              columns={[
                { key: "member", header: "Member", cell: (member) => <span className="font-medium">{member.name || "—"}</span> },
                { key: "role", header: "Role", cell: (member) => member.role },
                { key: "email", header: "Email", cell: (member) => <span className="text-muted-foreground">{member.email}</span> },
                { key: "content", header: "Content", cell: (member) => member._count.contents },
                { key: "approvals", header: "Approvals", cell: (member) => member._count.approvals },
                { key: "status", header: "Status", cell: (member) => <Badge variant={member.isActive ? "success" : "warning"}>{member.isActive ? "active" : "inactive"}</Badge> },
              ]}
              card={{
                title: (member) => member.name || member.email,
                badge: (member) => <Badge variant={member.isActive ? "success" : "warning"}>{member.isActive ? "active" : "inactive"}</Badge>,
                fields: [
                  { label: "Role", value: (member) => member.role },
                  { label: "Email", value: (member) => member.email },
                  { label: "Content", value: (member) => member._count.contents },
                  { label: "Approvals", value: (member) => member._count.approvals },
                ],
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
