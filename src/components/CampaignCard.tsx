import Link from "next/link";
import { formatCountdown, formatPercent, stroopsToXlm } from "@/lib/format";
import type { CampaignStatus } from "@/types/domain";

export function CampaignCard({ status }: { status: CampaignStatus }) {
  const pct = formatPercent(status.totalPledged, status.goal);
  const isFunded = pct >= 100;

  return (
    <Link
      href={`/campaign/${status.meta.id}`}
      className="group flex flex-col rounded-2xl border border-ledger-800 bg-ledger-900/60 p-5 transition hover:border-brass-600/50 hover:bg-ledger-900"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-ledger-800 px-2.5 py-1 text-xs text-ledger-300">
          {status.meta.category}
        </span>
        {isFunded && (
          <span className="rounded-full bg-signal-green/15 px-2.5 py-1 text-xs font-medium text-signal-green">
            Funded
          </span>
        )}
      </div>

      <h3 className="mt-4 font-display text-xl leading-snug text-ledger-50 group-hover:text-brass-200">
        {status.meta.title}
      </h3>

      <div className="mt-5 flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ledger-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brass-600 to-brass-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-sm">
          <span className="font-mono text-ledger-100">
            {stroopsToXlm(status.totalPledged)} <span className="text-ledger-400">XLM</span>
          </span>
          <span className="text-ledger-400">{pct.toFixed(0)}% of goal</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-ledger-500">{formatCountdown(status.deadline)}</p>
    </Link>
  );
}
