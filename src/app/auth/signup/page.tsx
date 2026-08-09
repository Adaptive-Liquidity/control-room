"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/auth/signin?registered=1");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1 p-8 shadow-xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-aeon-teal to-emerald-500 text-xl font-black text-aeon-navy-1">
          A
        </div>
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join AEON Marketing Command Center
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-aeon-navy-3 bg-aeon-navy-1 px-4 py-3 text-sm outline-none transition-colors focus:border-aeon-teal"
            placeholder="Alex Chen"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-aeon-navy-3 bg-aeon-navy-1 px-4 py-3 text-sm outline-none transition-colors focus:border-aeon-teal"
            placeholder="you@aeonprotocol.xyz"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-aeon-navy-3 bg-aeon-navy-1 px-4 py-3 text-sm outline-none transition-colors focus:border-aeon-teal"
            placeholder="At least 8 characters"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-aeon-teal to-emerald-500 font-bold text-aeon-navy-1 hover:opacity-90"
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/signin" className="font-semibold text-aeon-teal hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
