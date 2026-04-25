import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { ACTIVE_CHAIN, celoMainnet } from "./contracts";

// `ssr: true` is required in the Next.js App Router — it tells wagmi to
// skip localStorage reads on the server so SSR never crashes, and returns
// empty state on the initial client render to keep server/client HTML in
// sync. The mount guard in hooks/use-connect.ts handles the subsequent
// flip to the real wallet state without surfacing a hydration mismatch.
export const wagmiConfig = createConfig({
  chains: [celoMainnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [celoMainnet.id]: http(celoMainnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export const DEFAULT_CHAIN_ID = ACTIVE_CHAIN.id;
