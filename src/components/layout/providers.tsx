"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { Toaster } from "@/components/ui/toaster";

function RealtimeSubscriber({ children }: { children: React.ReactNode }) {
  useRealtime();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <RealtimeSubscriber>{children}</RealtimeSubscriber>
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
