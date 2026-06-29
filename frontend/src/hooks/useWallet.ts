"use client";

import { useCallback, useEffect, useState } from "react";
import { Horizon } from "@stellar/stellar-sdk";
import { NETWORK } from "@/lib/network";
import {
  connectWallet,
  getConnectedAddress,
  isWalletInstalled,
  WalletNotInstalledError,
  WalletRejectedError,
} from "@/lib/wallet";
import type { WalletState } from "@/types/domain";

const HORIZON_URLS = {
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};
const horizon = new Horizon.Server(HORIZON_URLS[NETWORK]);

interface UseWalletResult extends WalletState {
  isInstalled: boolean | null; // null = still checking
  connect: () => Promise<void>;
  disconnect: () => void;
  connectError: string | null;
  isConnecting: boolean;
  balance: string | null;
}

export function useWallet(): UseWalletResult {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    network: null,
  });
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const installed = await isWalletInstalled();
      if (!mounted) return;
      setIsInstalled(installed);
      if (installed) {
        const existing = await getConnectedAddress();
        if (mounted && existing) {
          setState({ isConnected: true, publicKey: existing, network: null });
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Poll for balance when connected
  useEffect(() => {
    if (!state.isConnected || !state.publicKey) {
      setBalance(null);
      return;
    }

    let mounted = true;

    async function fetchBalance() {
      if (!state.publicKey) return;
      try {
        const account = await horizon.loadAccount(state.publicKey);
        const nativeBalance = account.balances.find((b: any) => b.asset_type === "native");
        if (mounted) {
          setBalance(nativeBalance ? nativeBalance.balance : "0");
        }
      } catch (err) {
        // Account might not be funded on the network yet
        if (mounted) setBalance("0");
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000); // Poll every 5 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [state.isConnected, state.publicKey]);

  const connect = useCallback(async () => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      const { publicKey, network } = await connectWallet();
      setState({ isConnected: true, publicKey, network });
    } catch (err) {
      if (err instanceof WalletNotInstalledError) {
        setConnectError("Install the Freighter wallet extension to continue.");
      } else if (err instanceof WalletRejectedError) {
        setConnectError("Connection request was declined.");
      } else {
        setConnectError("Could not connect to the wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ isConnected: false, publicKey: null, network: null });
  }, []);

  return { ...state, isInstalled, connect, disconnect, connectError, isConnecting, balance };
}
