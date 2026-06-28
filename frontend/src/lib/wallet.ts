"use client";

/**
 * Thin wrapper around the Freighter wallet browser extension API.
 * All calls are defensive: if `window.freighterApi` isn't present (extension
 * not installed) or the user rejects a request, callers get a typed error
 * instead of an unhandled exception, so the UI can show a clear message
 * rather than crash.
 */

export class WalletNotInstalledError extends Error {
  constructor() {
    super("Freighter wallet extension not detected.");
    this.name = "WalletNotInstalledError";
  }
}

export class WalletRejectedError extends Error {
  constructor(message = "Request was rejected in the wallet.") {
    super(message);
    this.name = "WalletRejectedError";
  }
}

interface FreighterApi {
  isConnected: () => Promise<{ isConnected: boolean }>;
  isAllowed: () => Promise<{ isAllowed: boolean }>;
  setAllowed: () => Promise<{ isAllowed: boolean }>;
  requestAccess: () => Promise<{ address: string; error?: string }>;
  getAddress: () => Promise<{ address: string; error?: string }>;
  getNetwork: () => Promise<{ network: string; networkPassphrase: string }>;
  signTransaction: (
    xdr: string,
    opts: { networkPassphrase: string }
  ) => Promise<{ signedTxXdr: string; error?: string }>;
}

declare global {
  interface Window {
    freighterApi?: FreighterApi;
  }
}

function getApi(): FreighterApi {
  if (typeof window === "undefined" || !window.freighterApi) {
    throw new WalletNotInstalledError();
  }
  return window.freighterApi;
}

export async function isWalletInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return Boolean(window.freighterApi);
}

export async function connectWallet(): Promise<{ publicKey: string; network: string }> {
  const api = getApi();
  const access = await api.requestAccess();
  if (access.error || !access.address) {
    throw new WalletRejectedError(access.error);
  }
  const net = await api.getNetwork();
  return { publicKey: access.address, network: net.network };
}

export async function getConnectedAddress(): Promise<string | null> {
  try {
    const api = getApi();
    const allowed = await api.isAllowed();
    if (!allowed.isAllowed) return null;
    const res = await api.getAddress();
    return res.address || null;
  } catch {
    return null;
  }
}

export async function signTransactionXdr(
  xdr: string,
  networkPassphrase: string
): Promise<string> {
  const api = getApi();
  const result = await api.signTransaction(xdr, { networkPassphrase });
  if (result.error || !result.signedTxXdr) {
    throw new WalletRejectedError(result.error);
  }
  return result.signedTxXdr;
}
