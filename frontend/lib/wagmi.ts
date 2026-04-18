import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { ACTIVE_CHAIN, celoMainnet, celoSepolia } from "./contracts";

export const wagmiConfig = createConfig({
  chains: [celoSepolia, celoMainnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [celoSepolia.id]: http(celoSepolia.rpcUrls.default.http[0]),
    [celoMainnet.id]: http(celoMainnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export const DEFAULT_CHAIN_ID = ACTIVE_CHAIN.id;
