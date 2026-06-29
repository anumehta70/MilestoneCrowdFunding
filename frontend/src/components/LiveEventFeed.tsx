"use client";

import { useEventStream } from "@/hooks/useEventStream";
import { formatRelativeTime } from "@/lib/format";
import type { ContractEventType } from "@/types/domain";

const EVENT_LABELS: Record<ContractEventType | "unknown", string> = {
  campaign_init: "Campaign created",
  pledge_made: "New pledge",
  milestone_approved: "Milestone approved",
  funds_released: "Funds released",
  refund_issued: "Refund issued",
  campaign_registered: "Campaign listed",
  vault_deposit: "Vault deposit",
  vault_withdraw: "Vault withdrawal",
  unknown: "Activity",
};

const EVENT_COLORS: Record<ContractEventType | "unknown", string> = {
  campaign_init: "bg-ledger-500",
  pledge_made: "bg-signal-green",
  milestone_approved: "bg-brass-400",
  funds_released: "bg-brass-500",
  refund_issued: "bg-signal-amber",
  campaign_registered: "bg-ledger-400",
  vault_deposit: "bg-signal-green",
  vault_withdraw: "bg-brass-500",
  unknown: "bg-ledger-500",
};

export function LiveEventFeed({ contractIds }: { contractIds: string[] }) {
  const { events, isConnected, error } = useEventStream({ contractIds });

  return (
    <div className="rounded-2xl border border-ledger-800 bg-ledger-900/40">
      <div className="flex items-center justify-between border-b border-ledger-800 px-4 py-3">
        <h3 className="text-sm font-medium text-ledger-200">Live activity</h3>
        <span className="flex items-center gap-1.5 text-xs text-ledger-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? "bg-signal-green animate-pulse-slow" : "bg-ledger-600"
            }`}
          />
          {isConnected ? "Streaming" : "Connecting…"}
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-3">
        {error && (
          <p className="py-4 text-center text-xs text-signal-red">
            Couldn&apos;t reach the event stream. Retrying…
          </p>
        )}

        {!error && events.length === 0 && (
          <p className="py-6 text-center text-xs text-ledger-500">
            No on-chain activity yet for this campaign. Pledges and milestone
            updates will appear here in real time.
          </p>
        )}

        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3 animate-slide-up">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${EVENT_COLORS[event.type]}`}
              />
              <div className="flex-1">
                <p className="text-sm text-ledger-100">{EVENT_LABELS[event.type]}</p>
                <p className="text-xs text-ledger-500">
                  Ledger {event.ledger} · {formatRelativeTime(event.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
