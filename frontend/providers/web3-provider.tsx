"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { WagmiProvider, useAccount, useDisconnect, useReconnect } from "wagmi";
import { WalletPicker } from "@/components/wallet-picker";
import { wagmiConfig } from "@/lib/wagmi";

// LocalStorage flag recording an *explicit* user disconnect. Wagmi's
// built-in reconnect looks at wallet extension state, but if the user
// clicked "Disconnect" we must override that and stay disconnected until
// they explicitly connect again. See hooks/use-connect.ts where this flag
// is set/cleared.
export const DISCONNECT_FLAG = "gambit:disconnected";

function hasExplicitDisconnect(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISCONNECT_FLAG) === "1";
}

// Run on every mount. Wagmi auto-rehydrates its connector state from
// localStorage BEFORE our code runs, so `shimDisconnect` alone doesn't
// always stick. We enforce the user's explicit disconnect intent here:
// - If the flag is set, force a disconnect whenever wagmi thinks we're
//   still connected (and never trigger reconnect).
// - If the flag isn't set, normal reconnect path.
function AutoReconnect() {
  const { reconnect } = useReconnect();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (hasExplicitDisconnect()) {
      if (isConnected) disconnect();
      return;
    }
    reconnect();
  }, [reconnect, disconnect, isConnected]);

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
        openPicker: () => {
          // User opening the picker is an explicit intent to connect — clear
          // the "stay disconnected" flag so subsequent reconnects work.
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(DISCONNECT_FLAG);
          }
          setOpen(true);
        },
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
