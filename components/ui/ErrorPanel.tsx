"use client";

interface ErrorPanelProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorPanel({
  title = "Something went wrong",
  message = "We couldn't load this content. Please try again.",
  onRetry,
}: ErrorPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[--kt-red-soft] flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-[--kt-red]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[--kt-text] mb-1">{title}</h3>
      <p className="text-sm text-[--kt-text-muted] max-w-sm mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 h-12 px-4 rounded-xl bg-[--kt-surface-muted] text-[--kt-text-soft] text-sm font-medium hover:bg-[--kt-border] transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
