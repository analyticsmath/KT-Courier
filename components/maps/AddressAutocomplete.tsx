"use client";

import { useState, useRef, useCallback, useId } from "react";
import { usePlacesAutocomplete } from "@/lib/maps/use-places-autocomplete";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import type { AddressDto } from "@/lib/maps/google-maps.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressAutocompleteValue {
  formattedAddress: string;
  placeId: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

interface AddressAutocompleteProps {
  id?: string;
  label: string;
  required?: boolean;
  value: AddressAutocompleteValue | null;
  onChange: (value: AddressAutocompleteValue | null) => void;
  contactName?: string;
  contactPhone?: string;
  onContactNameChange?: (v: string) => void;
  onContactPhoneChange?: (v: string) => void;
  accessNotes?: string;
  onAccessNotesChange?: (v: string) => void;
  error?: string;
  showContactFields?: boolean;
  showNotesField?: boolean;
  contactNameLabel?: string;
  contactPhoneLabel?: string;
}

// ─── Manual fallback form ─────────────────────────────────────────────────────

interface ManualAddressState {
  line1: string;
  city: string;
  province: string;
  postalCode: string;
}

function ManualAddressFields({
  value,
  onChange,
  idPrefix,
  required,
  error,
}: {
  value: ManualAddressState;
  onChange: (key: keyof ManualAddressState, val: string) => void;
  idPrefix: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}_line1`} required={required}>Street address</Label>
        <Input
          id={`${idPrefix}_line1`}
          placeholder="e.g. 15 Long Street"
          value={value.line1}
          onChange={(e) => onChange("line1", e.target.value)}
          aria-invalid={!!error}
        />
        {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}_city`}>City / suburb</Label>
          <Input
            id={`${idPrefix}_city`}
            placeholder="e.g. Cape Town"
            value={value.city}
            onChange={(e) => onChange("city", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}_province`}>Province</Label>
          <Input
            id={`${idPrefix}_province`}
            placeholder="e.g. Western Cape"
            value={value.province}
            onChange={(e) => onChange("province", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}_postal`}>Postal code</Label>
        <Input
          id={`${idPrefix}_postal`}
          placeholder="e.g. 8001"
          value={value.postalCode}
          onChange={(e) => onChange("postalCode", e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AddressAutocomplete({
  id: externalId,
  label,
  required,
  value,
  onChange,
  contactName = "",
  contactPhone = "",
  onContactNameChange,
  onContactPhoneChange,
  accessNotes = "",
  onAccessNotesChange,
  error,
  showContactFields = true,
  showNotesField = true,
  contactNameLabel = "Contact name",
  contactPhoneLabel = "Phone number",
}: AddressAutocompleteProps) {
  const autoId = useId();
  const inputId = externalId ?? `addr_${autoId}`;

  const hasBrowserKey = !!(
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
      : null
  );

  const { apiReady, apiError, predictions, loading, search, selectPrediction, clearPredictions } =
    usePlacesAutocomplete({
      regionBias: process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION_BIAS ?? "ZA",
    });

  const [inputValue, setInputValue] = useState(value?.formattedAddress ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const [manual, setManual] = useState<ManualAddressState>({
    line1: value?.line1 ?? "",
    city: value?.city ?? "",
    province: value?.province ?? "",
    postalCode: value?.postalCode ?? "",
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const useGoogleUI = (hasBrowserKey || apiReady) && !apiError;

  const handleInputChange = useCallback(
    (text: string) => {
      setInputValue(text);
      onChange(null);
      if (text.length >= 3) {
        search(text);
        setShowDropdown(true);
      } else {
        clearPredictions();
        setShowDropdown(false);
      }
    },
    [onChange, search, clearPredictions]
  );

  const handleSelect = useCallback(
    async (placeId: string, description: string) => {
      setSelecting(true);
      setShowDropdown(false);
      clearPredictions();
      setInputValue(description);

      const detail = await selectPrediction(placeId);
      setSelecting(false);

      if (detail) {
        setInputValue(detail.formattedAddress);
        onChange(detail);
      } else {
        onChange({
          formattedAddress: description,
          placeId,
          line1: description,
          line2: null,
          city: null,
          province: null,
          postalCode: null,
          country: "South Africa",
          latitude: null,
          longitude: null,
        });
      }
    },
    [selectPrediction, onChange, clearPredictions]
  );

  const handleManualChange = useCallback(
    (key: keyof ManualAddressState, val: string) => {
      const next = { ...manual, [key]: val };
      setManual(next);
      const addr: AddressAutocompleteValue = {
        formattedAddress: [next.line1, next.city, next.province, next.postalCode, "South Africa"]
          .filter(Boolean)
          .join(", "),
        placeId: null,
        line1: next.line1,
        line2: null,
        city: next.city || null,
        province: next.province || null,
        postalCode: next.postalCode || null,
        country: "South Africa",
        // Text entry deliberately has no inferred coordinates. Quotes and route
        // estimates remain unavailable until the configured provider confirms an address.
        latitude: null,
        longitude: null,
      };
      onChange(next.line1.trim().length >= 3 ? addr : null);
    },
    [manual, onChange]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        setShowDropdown(false);
      }
    }, 150);
  }, []);

  return (
    <div className="space-y-3">
      {/* Contact fields */}
      {showContactFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${inputId}_cname`}>{contactNameLabel}</Label>
            <Input
              id={`${inputId}_cname`}
              placeholder="Full name"
              value={contactName}
              onChange={(e) => onContactNameChange?.(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${inputId}_cphone`}>{contactPhoneLabel}</Label>
            <Input
              id={`${inputId}_cphone`}
              type="tel"
              placeholder="e.g. 082 000 0000"
              value={contactPhone}
              onChange={(e) => onContactPhoneChange?.(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Address input */}
      {useGoogleUI ? (
        <div ref={wrapperRef} className="relative" onBlur={handleBlur}>
          <Label htmlFor={inputId} required={required}>{label}</Label>
          <div
            className="relative"
            role="combobox"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-controls={`${inputId}_listbox`}
          >
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              autoComplete="off"
              placeholder="Start typing an address…"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => predictions.length > 0 && setShowDropdown(true)}
              aria-label={label}
              aria-autocomplete="list"
              aria-invalid={!!error}
              className="w-full px-3 py-2 text-sm border border-[var(--kt-border)] rounded-xl bg-[var(--kt-input-bg)] text-[var(--kt-ink-navy)] placeholder-[var(--kt-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-signal-cobalt)] focus:border-transparent transition"
            />
            {(loading || selecting) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 text-[var(--kt-text-muted)] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              </span>
            )}
          </div>

          {showDropdown && predictions.length > 0 && (
            <ul
              id={`${inputId}_listbox`}
              role="listbox"
              aria-label="Address suggestions"
              className="absolute z-50 w-full mt-1 bg-[var(--kt-studio-white)] border border-[var(--kt-border)] rounded-xl shadow-lg overflow-hidden"
            >
              {predictions.map((p) => (
                <li key={p.placeId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--kt-cloud-blue)] transition-colors focus:outline-none focus:bg-[var(--kt-cloud-blue)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(p.placeId, p.description)}
                  >
                    <p className="text-sm font-medium text-[var(--kt-ink-navy)] truncate">{p.mainText}</p>
                    <p className="text-xs text-[var(--kt-text-muted)] truncate">{p.secondaryText}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}

          {typeof value?.latitude === "number" && typeof value.longitude === "number" && (
            <p className="mt-1 text-xs text-[var(--kt-teal-emerald)] flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Address confirmed
            </p>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 px-3 py-2 bg-[var(--kt-amber-wash)] border border-[var(--kt-solar-amber)]/30 rounded-lg text-xs text-[var(--kt-ink-navy)]">
            Address suggestions are unavailable. Use text entry; a quote cannot be generated until an address provider confirms mapped coordinates.
          </div>
          <ManualAddressFields
            value={manual}
            onChange={handleManualChange}
            idPrefix={inputId}
            required={required}
            error={error}
          />
        </div>
      )}

      {/* Access notes */}
      {showNotesField && (
        <div>
          <Label htmlFor={`${inputId}_notes`}>Access notes</Label>
          <Input
            id={`${inputId}_notes`}
            placeholder="e.g. Buzz flat 3, leave at reception"
            value={accessNotes}
            onChange={(e) => onAccessNotesChange?.(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Re-export for convenience ────────────────────────────────────────────────

export type { AddressDto };
