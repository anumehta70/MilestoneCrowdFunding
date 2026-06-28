"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CampaignCard } from "@/components/CampaignCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/StateViews";
import { getCampaignStatus, listCampaignIds } from "@/lib/api";
import { CONTRACT_IDS } from "@/lib/network";
import type { AsyncStatus, CampaignStatus } from "@/types/domain";

// A throwaway read-only simulation account; Soroban view-call simulation
// doesn't debit or require this account to be funded, it's only used to
// build a well-formed transaction envelope for simulation.
const VIEWER_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJEU";

export default function HomePage() {
  const [status, setStatus] = useState<AsyncStatus>("loading");
  const [campaigns, setCampaigns] = useState<CampaignStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      if (!CONTRACT_IDS.registry) {
        setCampaigns([]);
        setStatus("success");
        return;
      }
      const ids = await listCampaignIds(VIEWER_ACCOUNT);
      const results = await Promise.all(
        ids.map((id) => getCampaignStatus(id, VIEWER_ACCOUNT))
      );
      setCampaigns(results);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Couldn't load campaigns from the network."
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section className="vault-grid-bg -mx-4 mb-12 rounded-3xl border border-ledger-800 px-6 py-14 sm:mx-0 sm:px-12">
          <p className="text-xs uppercase tracking-[0.2em] text-brass-400">
            Escrowed · Milestone-gated · On-chain
          </p>
          <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.1] text-ledger-50 text-balance sm:text-5xl">
            Funds locked in a vault, until the work is proven.
          </h1>
          <p className="mt-4 max-w-md text-ledger-400">
            Backers pledge to campaigns; pledges sit in escrow earning yield.
            Creators unlock funds only when each milestone is approved —
            transparently, on the Stellar network.
          </p>
          <Link
            href="/create"
            className="mt-8 inline-block rounded-full bg-brass-500 px-6 py-3 text-sm font-medium text-ledger-950 transition hover:bg-brass-400"
          >
            Start a campaign
          </Link>
        </section>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ledger-50">Active campaigns</h2>
        </div>

        {status === "loading" && <LoadingState label="Reading campaigns from the registry…" />}

        {status === "error" && error && (
          <ErrorState message={error} onRetry={load} />
        )}

        {status === "success" && campaigns.length === 0 && (
          <EmptyState
            title="No campaigns yet"
            message="Once a campaign is registered on-chain, it will appear here for everyone to discover and back."
            action={
              <Link
                href="/create"
                className="rounded-full border border-brass-500 px-5 py-2.5 text-sm text-brass-300 transition hover:bg-brass-500/10"
              >
                Be the first to launch one
              </Link>
            }
          />
        )}

        {status === "success" && campaigns.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.meta.id} status={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
