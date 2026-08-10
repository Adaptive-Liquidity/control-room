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
    <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground/90">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Access your workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {registered && (
          <div className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
            Account created. Sign in to continue.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/auth/signup" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
