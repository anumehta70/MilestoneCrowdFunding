export type NetworkName = "testnet" | "mainnet" | "futurenet";

export const NETWORK: NetworkName =
  (process.env.NEXT_PUBLIC_NETWORK as NetworkName) || "testnet";

export const RPC_URLS: Record<NetworkName, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

export const NETWORK_PASSPHRASES: Record<NetworkName, string> = {
  testnet: "Test SDF Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
  mainnet: "Public Global Stellar Network ; September 2015",
};

export const CONTRACT_IDS = {
  registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "",
  escrowFactory: process.env.NEXT_PUBLIC_ESCROW_FACTORY_CONTRACT_ID ?? "",
};

export const RPC_URL = RPC_URLS[NETWORK];
export const NETWORK_PASSPHRASE = NETWORK_PASSPHRASES[NETWORK];

/** Polling interval for the event-streaming hook, in milliseconds. */
export const EVENT_POLL_INTERVAL_MS = 6_000;
