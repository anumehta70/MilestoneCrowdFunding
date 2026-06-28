export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ledger-400">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-ledger-700 border-t-brass-400" />
      </div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-signal-red/30 bg-signal-red/5 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-signal-red/15 text-signal-red">
        !
      </div>
      <p className="font-medium text-ledger-100">{title}</p>
      <p className="max-w-sm text-sm text-ledger-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-full border border-ledger-600 px-4 py-1.5 text-sm transition hover:border-brass-500 hover:text-brass-300"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ledger-700 px-6 py-16 text-center">
      <p className="font-display text-lg text-ledger-100">{title}</p>
      <p className="max-w-sm text-sm text-ledger-400">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
