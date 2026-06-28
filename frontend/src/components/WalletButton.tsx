"use client";

import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/format";

export function WalletButton() {
  const { isConnected, publicKey, connect, disconnect, connectError, isConnecting, balance } =
    useWallet();

  if (isConnected && publicKey) {
    return (
      <button
        onClick={disconnect}
        className="group flex items-center gap-3 rounded-full border border-ledger-600 bg-ledger-800/60 px-4 py-2 text-sm transition hover:border-signal-red/60"
        title="Click to disconnect"
      >
        <span className="h-2 w-2 rounded-full bg-signal-green" aria-hidden />
        <span className="font-mono text-ledger-200 group-hover:hidden">
          {balance !== null ? `${Number(balance).toFixed(2)} XLM | ` : ""}
          {shortenAddress(publicKey)}
        </span>
        <span className="hidden font-mono text-signal-red group-hover:inline">Disconnect</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={isConnecting}
        className="rounded-full bg-brass-500 px-4 py-2 text-sm font-medium text-ledger-950 transition hover:bg-brass-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConnecting ? "Connecting…" : "Connect wallet"}
      </button>
      {connectError && <span className="text-xs text-signal-red">{connectError}</span>}
    </div>
  );
}
