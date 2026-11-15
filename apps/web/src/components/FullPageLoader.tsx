interface FullPageLoaderProps {
  message?: string;
}

export function FullPageLoader({ message = 'Loading...' }: FullPageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-600"
    >
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600"
      />
      <span>{message}</span>
    </div>
  );
}
