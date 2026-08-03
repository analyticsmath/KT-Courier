import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface DashboardTopbarProps {
  userName?: string;
  userRole?: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  onMenuOpen?: () => void;
}

export function DashboardTopbar({
  userName,
  userRole,
  primaryAction,
  onMenuOpen,
}: DashboardTopbarProps) {
  const initials = userName
    ? userName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-30 bg-[var(--kt-studio-white)] border-b border-[var(--kt-soft-border)] shadow-[0_1px_4px_rgba(7,17,31,0.05)]">
      <div className="flex items-center justify-between h-14 px-4 sm:px-5">
        {/* Mobile: hamburger + brand */}
        <div className="flex items-center gap-2.5">
          {onMenuOpen && (
            <button
              onClick={onMenuOpen}
              className="lg:hidden p-2 rounded-xl text-[var(--kt-text-muted)] hover:bg-[var(--kt-cool-gray)] hover:text-[var(--kt-ink-navy)] transition-colors"
              aria-label="Open navigation"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          {/* Mobile brand mark */}
          <Link
            href="/"
            className="lg:hidden flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)] rounded-lg"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--kt-ink-navy)] text-white flex-shrink-0">
              <span className="font-display text-xs font-black tracking-normal">KT</span>
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--kt-solar-amber)] ring-1 ring-white"
                aria-hidden="true"
              />
            </span>
          </Link>
        </div>

        {/* Right: action + user */}
        <div className="flex items-center gap-2.5">
          {primaryAction && (
            <Button href={primaryAction.href} variant="primary" size="sm">
              {primaryAction.label}
            </Button>
          )}
          <div className="flex items-center gap-2.5 pl-2.5 border-l border-[var(--kt-soft-border)]">
            <div
              className="w-8 h-8 rounded-full bg-[var(--kt-signal-cobalt)] flex items-center justify-center text-white text-[11px] font-extrabold select-none flex-shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-bold text-[var(--kt-ink-navy)] truncate max-w-[120px]">
                {userName ?? "User"}
              </p>
              {userRole && (
                <p className="text-[10px] font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">
                  {userRole}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
