"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
    <div className="rounded-2xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1 p-8 shadow-xl text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-xl text-red-400">
        !
      </div>
      <h1 className="text-2xl font-bold">Authentication error</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      {error !== "Default" && (
        <p className="mt-2 font-mono text-xs text-aeon-navy-5">Code: {error}</p>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/auth/signin"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-aeon-teal to-emerald-500 px-4 text-sm font-bold text-aeon-navy-1 hover:opacity-90"
        >
          Back to sign in
        </Link>
        <Link href="/auth/signup" className="text-sm text-aeon-teal hover:underline">
          Create a new account
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-aeon-navy-3 bg-aeon-navy-2 p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
