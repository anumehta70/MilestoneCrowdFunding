"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { useWallet } from "@/hooks/useWallet";
import { registerCampaign } from "@/lib/api";
import { xlmToStroops } from "@/lib/format";

interface MilestoneInput {
  description: string;
  releasePercent: string;
}

const CATEGORIES = ["Education", "Technology", "Climate", "Community", "Art & Culture", "Health"];
const DEFAULT_CATEGORY = CATEGORIES[0] as string;

export default function CreateCampaignPage() {
  const router = useRouter();
  const { isConnected, publicKey, connect } = useWallet();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [goal, setGoal] = useState("");
  const [escrowAddress, setEscrowAddress] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { description: "", releasePercent: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percentTotal = milestones.reduce(
    (sum, m) => sum + (Number(m.releasePercent) || 0),
    0
  );

  function updateMilestone(index: number, patch: Partial<MilestoneInput>) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, { description: "", releasePercent: "" }]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isConnected || !publicKey) {
      await connect();
      return;
    }
    if (!title.trim()) {
      setError("Give your campaign a title.");
      return;
    }
    if (!goal || Number(goal) <= 0) {
      setError("Set a funding goal greater than zero.");
      return;
    }
    if (Math.round(percentTotal) !== 100) {
      setError("Milestone release percentages must add up to exactly 100%.");
      return;
    }
    if (!escrowAddress.trim()) {
      setError(
        "Deploy the Escrow contract for this campaign first (see the README), then paste its contract address here."
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerCampaign(publicKey, title.trim(), category, escrowAddress.trim());
      router.push(`/?registered=${result.hash}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't register the campaign. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl text-ledger-50">Start a campaign</h1>
        <p className="mt-2 text-sm text-ledger-400">
          Deploy a dedicated Escrow contract for your campaign (instructions in
          the README), then register it here so backers can discover and fund it.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Solar Lantern for Rural Schools"
              className="input"
            />
          </Field>

          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Funding goal (XLM)">
            <input
              type="number"
              min="0"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="1000"
              className="input"
            />
            {goal && (
              <p className="mt-1 text-xs text-ledger-500">
                = {xlmToStroops(goal)} stroops on-chain
              </p>
            )}
          </Field>

          <Field label="Deployed escrow contract address">
            <input
              value={escrowAddress}
              onChange={(e) => setEscrowAddress(e.target.value)}
              placeholder="CCESCROW..."
              className="input font-mono text-sm"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-ledger-400">Milestones</label>
              <span
                className={`text-xs ${
                  Math.round(percentTotal) === 100 ? "text-signal-green" : "text-ledger-500"
                }`}
              >
                {percentTotal}% / 100%
              </span>
            </div>
            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={m.description}
                    onChange={(e) => updateMilestone(i, { description: e.target.value })}
                    placeholder={`Milestone ${i + 1} description`}
                    className="input flex-1"
                  />
                  <input
                    type="number"
                    value={m.releasePercent}
                    onChange={(e) => updateMilestone(i, { releasePercent: e.target.value })}
                    placeholder="%"
                    className="input w-20"
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="rounded-xl border border-ledger-700 px-3 text-ledger-400 transition hover:border-signal-red/50 hover:text-signal-red"
                      aria-label="Remove milestone"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addMilestone}
              className="mt-3 text-xs text-brass-300 underline-offset-2 hover:underline"
            >
              + Add milestone
            </button>
          </div>

          {error && <p className="text-sm text-signal-red">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brass-500 py-3 text-sm font-medium text-ledger-950 transition hover:bg-brass-400 disabled:opacity-60"
          >
            {submitting ? "Registering on-chain…" : isConnected ? "Register campaign" : "Connect wallet to continue"}
          </button>
        </form>
      </main>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-ledger-400">{label}</label>
      {children}
    </div>
  );
}
