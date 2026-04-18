"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WagmiProvider, useReconnect } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

function AutoReconnect() {
  const { reconnect } = useReconnect();
  useEffect(() => {
    // Silent reconnect after mount — MiniPay injects synchronously, so this
    // picks up the session without requiring a fresh tap.
    reconnect();
  }, [reconnect]);
  return null;
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AutoReconnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
