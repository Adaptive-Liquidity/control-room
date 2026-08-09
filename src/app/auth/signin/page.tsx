"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
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
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AEON Marketing Command Center
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {registered && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Account created. Sign in to continue.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-aeon-navy-3 bg-aeon-navy-1 px-4 py-3 text-sm outline-none transition-colors focus:border-aeon-teal"
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-aeon-teal to-emerald-500 font-bold text-aeon-navy-1 hover:opacity-90"
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/auth/signup" className="font-semibold text-aeon-teal hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-aeon-navy-3 bg-aeon-navy-2 p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
