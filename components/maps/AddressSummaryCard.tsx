// Server-safe display component — no client hooks.

interface AddressSummaryCardProps {
  label: string;
  labelColor?: "blue" | "teal";
  contactName?: string | null;
  contactPhone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  formattedAddress?: string | null;
  accessNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fallback?: string;
}

export function AddressSummaryCard({
  label,
  labelColor = "blue",
  contactName,
  contactPhone,
  line1,
  line2,
  city,
  province,
  postalCode,
  formattedAddress,
  accessNotes,
  latitude,
  longitude,
  fallback = "—",
}: AddressSummaryCardProps) {
  const dotClass =
    labelColor === "teal"
      ? "bg-[var(--kt-teal-emerald)]"
      : "bg-[var(--kt-signal-cobalt)]";

  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const hasContent = line1 || formattedAddress || contactName;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} aria-hidden="true" />
        <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">{label}</p>
      </div>

      {hasContent ? (
        <div className="space-y-1">
          {contactName && (
            <p className="text-sm font-semibold text-[var(--kt-ink-navy)]">{contactName}</p>
          )}
          {contactPhone && (
            <p className="text-sm text-[var(--kt-text-muted)]">{contactPhone}</p>
          )}
          {line1 && <p className="text-sm text-[var(--kt-text-muted)]">{line1}</p>}
          {line2 && <p className="text-sm text-[var(--kt-text-muted)]">{line2}</p>}
          {(city || province || postalCode) && (
            <p className="text-sm text-[var(--kt-text-muted)]">
              {[city, province, postalCode].filter(Boolean).join(", ")}
            </p>
          )}
          {!line1 && formattedAddress && (
            <p className="text-sm text-[var(--kt-text-muted)]">{formattedAddress}</p>
          )}
          {accessNotes && (
            <p className="text-xs text-[var(--kt-text-muted)] mt-1 italic">{accessNotes}</p>
          )}
          {hasCoords && (
            <p className="text-xs text-[var(--kt-teal-emerald)] flex items-center gap-1 mt-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              Coordinates captured
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--kt-text-muted)]">{fallback}</p>
      )}
    </div>
  );
}
