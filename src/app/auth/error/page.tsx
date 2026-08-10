"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server authentication configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link is no longer valid.",
  CredentialsSignin: "Invalid email or password.",
  Default: "An authentication error occurred. Please try again.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const message = ERROR_MESSAGES[error] || ERROR_MESSAGES.Default;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground/90">Authentication error</h1>
      </div>

      <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
        {message}
      </div>

      {error !== "Default" && (
        <p className="mt-3 text-center font-mono text-xs text-muted-foreground">Code: {error}</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
