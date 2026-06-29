import Link from "next/link";
import { WalletButton } from "./WalletButton";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ledger-800 bg-ledger-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <VaultMark />
          <span className="font-display text-lg tracking-tight text-ledger-50">Vaulted</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ledger-300 sm:flex">
          <Link href="/" className="transition hover:text-brass-300">
            Explore
          </Link>
          <Link href="/create" className="transition hover:text-brass-300">
            Start a campaign
          </Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}

function VaultMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="1" y="1" width="26" height="26" rx="6" className="fill-ledger-800 stroke-brass-600" strokeWidth="1" />
      <circle cx="14" cy="14" r="6.5" className="stroke-brass-400" strokeWidth="1.4" fill="none" />
      <circle cx="14" cy="14" r="1.6" className="fill-brass-400" />
      <line x1="14" y1="9" x2="14" y2="10.6" className="stroke-brass-400" strokeWidth="1.4" />
    </svg>
  );
}
