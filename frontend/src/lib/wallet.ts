"use client";

import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
  signTransaction,
} from "@stellar/freighter-api";

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

export async function isWalletInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const res = await isConnected();
  return res.isConnected;
}

export async function connectWallet(): Promise<{ publicKey: string; network: string }> {
  const installed = await isWalletInstalled();
  if (!installed) throw new WalletNotInstalledError();

  let access;
  try {
    access = await requestAccess();
  } catch (err: any) {
    throw new WalletRejectedError(err.message || "Request was rejected.");
  }

  if (access.error || !access.address) {
    throw new WalletRejectedError(access.error || "User rejected access.");
  }

  const net = await getNetworkDetails();
  return { publicKey: access.address, network: net.network };
}

export async function getConnectedAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const installed = await isWalletInstalled();
  if (!installed) return null;

  const allowed = await isAllowed();
  if (!allowed.isAllowed) return null;

  const res = await getAddress();
  return res.address || null;
}

export async function signTransactionXdr(
  xdr: string,
  networkPassphrase: string
): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase });
  if (result.error || !result.signedTxXdr) {
    throw new WalletRejectedError(result.error || "User rejected signature.");
  }
  return result.signedTxXdr;
}
