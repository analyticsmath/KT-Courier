// Server-safe route summary display component.
// Renders distance, duration, and region data from order or live calculation.

interface RoutePreviewCardProps {
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  routeSummary?: string | null;
  routeProvider?: string | null;
  routeCalculatedAt?: Date | string | null;
  regionName?: string | null;
  loading?: boolean;
  unavailableMessage?: string;
}

export function RoutePreviewCard({
  distanceMeters,
  durationSeconds,
  routeSummary,
  routeProvider,
  routeCalculatedAt,
  regionName,
  loading = false,
  unavailableMessage,
}: RoutePreviewCardProps) {
  const hasRoute =
    typeof distanceMeters === "number" && distanceMeters > 0;

  const displaySummary =
    routeSummary ??
    (hasRoute
      ? buildSummary(distanceMeters!, durationSeconds)
      : null);

  return (
    <div className="border border-[var(--kt-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-[var(--kt-signal-cobalt)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">Route estimate</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--kt-text-muted)]">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          Calculating route…
        </div>
      ) : hasRoute && displaySummary ? (
        <div className="space-y-2">
          <p className="text-xl font-bold text-[var(--kt-ink-navy)]">{displaySummary}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--kt-text-muted)]">
            {typeof distanceMeters === "number" && (
              <span>{(distanceMeters / 1000).toFixed(1)} km</span>
            )}
            {typeof durationSeconds === "number" && durationSeconds > 0 && (
              <span>~{Math.round(durationSeconds / 60)} min</span>
            )}
            {regionName && (
              <span className="text-[var(--kt-signal-cobalt)] font-medium">{regionName}</span>
            )}
          </div>
          {routeProvider && (
            <p className="text-xs text-[var(--kt-text-muted)]">
              Via {routeProvider === "google_routes" ? "Google Routes" : routeProvider}
              {routeCalculatedAt && (
                <span> · {new Date(routeCalculatedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--kt-text-muted)]">
          {unavailableMessage ?? "Route estimate unavailable. Distance will be confirmed when your order is reviewed."}
        </p>
      )}
    </div>
  );
}

function buildSummary(distanceMeters: number, durationSeconds?: number | null): string {
  const km = (distanceMeters / 1000).toFixed(1);
  if (durationSeconds && durationSeconds > 0) {
    return `${km} km · ~${Math.round(durationSeconds / 60)} min`;
  }
  return `${km} km`;
}
