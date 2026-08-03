"use client";

import { Card } from "./Card";
import { Button } from "./Button";

interface FeatureBlockerProps {
  title: string;
  description: string;
  dataStatus?: string; // e.g. "No booking has been created and no payment has been taken."
  alternativeAction?: string;
  supportEmail?: string;
  supportPhone?: string;
  backHref?: string;
  backLabel?: string;
}

export function FeatureBlocker({
  title,
  description,
  dataStatus = "No booking, quote or payment has been created.",
  alternativeAction,
  supportEmail,
  supportPhone,
  backHref = "/account",
  backLabel = "Back to Dashboard",
}: FeatureBlockerProps) {
  return (
    <Card
      variant="default"
      padding="lg"
      className="max-w-2xl mx-auto border-t-4 border-t-[var(--kt-brand-blue)] shadow-md"
    >
      <div className="flex flex-col items-center text-center space-y-6" role="region" aria-live="polite">
        {/* Restrained outline lock/safety icon */}
        <div className="w-14 h-14 rounded-2xl bg-[var(--kt-cloud-blue)] flex items-center justify-center text-[var(--kt-signal-cobalt)]">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl sm:text-2xl font-black text-[var(--kt-navy)] tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-[var(--kt-text-muted)] leading-relaxed max-w-lg mx-auto">
            {description}
          </p>
        </div>

        {/* Clear non-playful transaction state banner */}
        {dataStatus && (
          <div className="w-full bg-[var(--kt-cool-gray)] rounded-xl border border-[var(--kt-soft-border)] px-4 py-3 text-center">
            <p className="text-xs font-extrabold text-[var(--kt-brand-navy)] tracking-wide uppercase">
              Transaction Status
            </p>
            <p className="text-sm font-bold text-[var(--kt-navy)] mt-1">
              {dataStatus}
            </p>
          </div>
        )}

        {/* Alternative Action / Support contact details */}
        {(alternativeAction || supportEmail || supportPhone) && (
          <div className="w-full border-t border-[var(--kt-soft-border)] pt-5 text-left space-y-3">
            <h3 className="text-xs font-extrabold text-[var(--kt-brand-navy)] uppercase tracking-wider">
              Available Alternatives
            </h3>
            {alternativeAction && (
              <p className="text-sm text-[var(--kt-text)] leading-relaxed">
                {alternativeAction}
              </p>
            )}
            {(supportEmail || supportPhone) && (
              <div className="bg-[var(--kt-cloud-blue)]/50 rounded-xl p-3.5 space-y-1.5 border border-[var(--kt-soft-border)]/40 text-sm">
                {supportEmail && (
                  <p className="font-semibold text-[var(--kt-navy)]">
                    Email Support:{" "}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="text-[var(--kt-signal-cobalt)] hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-brand-blue)] rounded px-1"
                    >
                      {supportEmail}
                    </a>
                  </p>
                )}
                {supportPhone && (
                  <p className="font-semibold text-[var(--kt-navy)]">
                    Logistics Desk:{" "}
                    <a
                      href={`tel:${supportPhone.replace(/\s+/g, "")}`}
                      className="text-[var(--kt-signal-cobalt)] hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-brand-blue)] rounded px-1"
                    >
                      {supportPhone}
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Back navigation button */}
        <div className="pt-4 w-full flex justify-center border-t border-[var(--kt-soft-border)]">
          <Button href={backHref} variant="secondary" size="md">
            {backLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
