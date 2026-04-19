"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { WagmiProvider, useReconnect } from "wagmi";
import { WalletPicker } from "@/components/wallet-picker";
import { wagmiConfig } from "@/lib/wagmi";

function AutoReconnect() {
  const { reconnect } = useReconnect();
  useEffect(() => {
    reconnect();
  }, [reconnect]);
  return null;
}

type ConnectDialogCtx = {
  open: boolean;
  openPicker: () => void;
  closePicker: () => void;
};

const ConnectDialogContext = createContext<ConnectDialogCtx | null>(null);

export function useConnectDialog() {
  const ctx = useContext(ConnectDialogContext);
  if (!ctx) throw new Error("useConnectDialog must be used within Web3Provider");
  return ctx;
}

function ConnectDialogHost({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ConnectDialogContext.Provider
      value={{
        open,
        openPicker: () => setOpen(true),
        closePicker: () => setOpen(false),
      }}
    >
      {children}
      <WalletPicker open={open} onClose={() => setOpen(false)} />
    </ConnectDialogContext.Provider>
  );
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
        <ConnectDialogHost>{children}</ConnectDialogHost>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
