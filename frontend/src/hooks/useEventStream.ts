"use client";

import { useEffect, useRef, useState } from "react";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { RPC_URL, EVENT_POLL_INTERVAL_MS } from "@/lib/network";
import type { ContractEventType, StreamedEvent } from "@/types/domain";

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

const EVENT_NAMES: ContractEventType[] = [
  "campaign_init",
  "pledge_made",
  "milestone_approved",
  "funds_released",
  "refund_issued",
  "campaign_registered",
  "vault_deposit",
  "vault_withdraw",
];

interface UseEventStreamOptions {
  /** Contract addresses to watch. Pass an empty array to pause streaming. */
  contractIds: string[];
  /** Max number of events kept in memory (oldest dropped first). */
  maxEvents?: number;
  /** Set false to pause polling without unmounting the hook. */
  enabled?: boolean;
}

interface UseEventStreamResult {
  events: StreamedEvent[];
  isConnected: boolean;
  error: string | null;
}

/**
 * Streams recent contract events by polling Soroban RPC's `getEvents`.
 * True server-push streaming isn't part of the public Soroban RPC surface
 * yet, so polling is the standard, production-accepted pattern -- this hook
 * keeps a rolling window of the most recent ledger range and de-dupes by
 * event id so the UI updates live without ever showing the same event twice.
 */
export function useEventStream({
  contractIds,
  maxEvents = 25,
  enabled = true,
}: UseEventStreamOptions): UseEventStreamResult {
  const [events, setEvents] = useState<StreamedEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLedgerRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || contractIds.length === 0) {
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const latestLedger = await server.getLatestLedger();
        const startLedger =
          lastLedgerRef.current ?? Math.max(latestLedger.sequence - 100, 1);

        const response = await server.getEvents({
          startLedger,
          filters: [
            {
              type: "contract",
              contractIds: contractIds as [string, ...string[]],
            },
          ],
          limit: 50,
        });

        if (cancelled) return;

        const newEvents: StreamedEvent[] = [];
        for (const evt of response.events) {
          const id = evt.id;
          if (seenIdsRef.current.has(id)) continue;
          seenIdsRef.current.add(id);

          const topicSymbol = evt.topic[0] ? scValToNative(evt.topic[0]) : "unknown";
          const eventType = EVENT_NAMES.includes(topicSymbol)
            ? (topicSymbol as ContractEventType)
            : ("unknown" as ContractEventType);

          let data: Record<string, unknown> = {};
          try {
            const decoded = scValToNative(evt.value);
            data = typeof decoded === "object" && decoded !== null ? decoded : { value: decoded };
          } catch {
            data = {};
          }

          const contractIdValue = evt.contractId;
          const normalizedContractId =
            typeof contractIdValue === "string"
              ? contractIdValue
              : contractIdValue && typeof contractIdValue === "object" && "contractId" in contractIdValue
              ? String((contractIdValue as { contractId: () => string }).contractId())
              : "";

          newEvents.push({
            id,
            type: eventType,
            ledger: evt.ledger,
            timestamp: evt.ledgerClosedAt ? Date.parse(evt.ledgerClosedAt) : Date.now(),
            contractId: normalizedContractId,
            data,
          });
        }

        if (newEvents.length > 0) {
          setEvents((prev) => {
            const merged = [...newEvents.reverse(), ...prev];
            return merged.slice(0, maxEvents);
          });
        }

        lastLedgerRef.current = latestLedger.sequence + 1;
        setIsConnected(true);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setIsConnected(false);
          setError(err instanceof Error ? err.message : "Event stream connection failed.");
        }
      }
    }

    poll();
    intervalId = setInterval(poll, EVENT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // contractIds is compared by reference intentionally; callers should
    // memoize the array they pass in.
  }, [contractIds, enabled, maxEvents]);

  return { events, isConnected, error };
}
