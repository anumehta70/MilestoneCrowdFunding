import { stroopsToXlm } from "@/lib/format";
import type { Milestone } from "@/types/domain";

export function MilestoneTimeline({
  milestones,
  goal,
  onApprove,
  onRelease,
  canManage,
  busyIndex,
}: {
  milestones: Milestone[];
  goal: string;
  onApprove?: (index: number) => void;
  onRelease?: (index: number) => void;
  canManage: boolean;
  busyIndex: number | null;
}) {
  return (
    <ol className="space-y-4">
      {milestones.map((milestone, index) => {
        const amount = (BigInt(goal) * BigInt(milestone.releaseBps)) / 10_000n;
        const status = milestone.released
          ? "released"
          : milestone.approved
          ? "approved"
          : "pending";

        return (
          <li
            key={index}
            className="flex items-start gap-4 rounded-xl border border-ledger-800 bg-ledger-900/40 p-4"
          >
            <StatusDot status={status} />
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-ledger-100">{milestone.description}</p>
                <span className="shrink-0 font-mono text-sm text-brass-300">
                  {stroopsToXlm(amount.toString())} XLM
                </span>
              </div>
              <p className="mt-1 text-xs capitalize text-ledger-500">{status}</p>
            </div>

            {canManage && status === "pending" && onApprove && (
              <button
                onClick={() => onApprove(index)}
                disabled={busyIndex === index}
                className="shrink-0 rounded-full border border-ledger-600 px-3 py-1.5 text-xs transition hover:border-brass-500 hover:text-brass-300 disabled:opacity-50"
              >
                {busyIndex === index ? "Approving…" : "Approve"}
              </button>
            )}

            {canManage && status === "approved" && onRelease && (
              <button
                onClick={() => onRelease(index)}
                disabled={busyIndex === index}
                className="shrink-0 rounded-full bg-brass-500 px-3 py-1.5 text-xs font-medium text-ledger-950 transition hover:bg-brass-400 disabled:opacity-50"
              >
                {busyIndex === index ? "Releasing…" : "Release funds"}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatusDot({ status }: { status: "pending" | "approved" | "released" }) {
  const styles = {
    pending: "border-ledger-600 bg-ledger-800",
    approved: "border-brass-400 bg-brass-400/20",
    released: "border-signal-green bg-signal-green/20",
  } as const;

  return (
    <div
      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${styles[status]}`}
    >
      {status === "released" && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-signal-green"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
