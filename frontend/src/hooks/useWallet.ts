"use client";

import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  getConnectedAddress,
  isWalletInstalled,
  WalletNotInstalledError,
  WalletRejectedError,
} from "@/lib/wallet";
import type { WalletState } from "@/types/domain";

interface UseWalletResult extends WalletState {
  isInstalled: boolean | null; // null = still checking
  connect: () => Promise<void>;
  disconnect: () => void;
  connectError: string | null;
  isConnecting: boolean;
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

  return { ...state, isInstalled, connect, disconnect, connectError, isConnecting };
}
