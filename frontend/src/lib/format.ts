const STROOPS_PER_XLM = 10_000_000n;

export function stroopsToXlm(stroops: string | bigint): string {
  const value = typeof stroops === "string" ? BigInt(stroops) : stroops;
  const whole = value / STROOPS_PER_XLM;
  const frac = value % STROOPS_PER_XLM;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

export function xlmToStroops(xlm: string): string {
  const trimmed = xlm.trim();
  if (!trimmed) return "0";
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  const value = BigInt(whole || "0") * STROOPS_PER_XLM + BigInt(fracPadded || "0");
  return value.toString();
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatPercent(numerator: string | bigint, denominator: string | bigint): number {
  const num = typeof numerator === "string" ? BigInt(numerator) : numerator;
  const den = typeof denominator === "string" ? BigInt(denominator) : denominator;
  if (den === 0n) return 0;
  const pct = (num * 10_000n) / den;
  return Math.min(Number(pct) / 100, 100);
}

export function formatCountdown(deadlineUnixSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = deadlineUnixSeconds - now;
  if (diff <= 0) return "Campaign ended";

  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3_600);

  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diff % 3_600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function formatRelativeTime(timestampMs: number): string {
  const diffSeconds = (Date.now() - timestampMs) / 1000;
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${Math.floor(diffSeconds)}s ago`;
  if (diffSeconds < 3_600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86_400) return `${Math.floor(diffSeconds / 3_600)}h ago`;
  return `${Math.floor(diffSeconds / 86_400)}d ago`;
}
