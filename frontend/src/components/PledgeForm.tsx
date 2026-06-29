"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { pledgeToCampaign } from "@/lib/api";
import { xlmToStroops } from "@/lib/format";
import type { AsyncStatus } from "@/types/domain";

export function PledgeForm({
  escrowAddress,
  onPledgeSuccess,
}: {
  escrowAddress: string;
  onPledgeSuccess?: () => void;
}) {
  const { isConnected, publicKey, connect } = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numeric = Number(amount);
    if (!amount || Number.isNaN(numeric) || numeric <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (!isConnected || !publicKey) {
      await connect();
      return;
    }

    setStatus("loading");
    try {
      const result = await pledgeToCampaign(escrowAddress, publicKey, xlmToStroops(amount));
      setTxHash(result.hash);
      setStatus("success");
      setAmount("");
      onPledgeSuccess?.();
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "The pledge couldn't be completed. Please try again."
      );
    }
  }

  if (status === "success" && txHash) {
    return (
      <div className="rounded-xl border border-signal-green/30 bg-signal-green/5 p-4">
        <p className="text-sm font-medium text-signal-green">Pledge confirmed</p>
        <p className="mt-1 text-xs text-ledger-400">
          Transaction{" "}
          <span className="font-mono text-ledger-300">
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </span>
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-3 text-xs text-brass-300 underline-offset-2 hover:underline"
        >
          Pledge again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-xs text-ledger-400" htmlFor="pledge-amount">
        Pledge amount (XLM)
      </label>
      <div className="flex gap-2">
        <input
          id="pledge-amount"
          type="number"
          min="0"
          step="0.0000001"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          disabled={status === "loading"}
          className="flex-1 rounded-xl border border-ledger-700 bg-ledger-900 px-4 py-3 font-mono text-ledger-50 outline-none placeholder:text-ledger-600 focus:border-brass-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="shrink-0 rounded-xl bg-brass-500 px-5 py-3 text-sm font-medium text-ledger-950 transition hover:bg-brass-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ledger-950/30 border-t-ledger-950" />
              Confirming…
            </span>
          ) : isConnected ? (
            "Pledge"
          ) : (
            "Connect to pledge"
          )}
        </button>
      </div>
      {error && <p className="text-xs text-signal-red">{error}</p>}
      <p className="text-xs text-ledger-500">
        Funds move into escrow immediately and accrue yield until milestones release them.
      </p>
    </form>
  );
}
