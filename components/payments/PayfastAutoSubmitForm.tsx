"use client";

import { useEffect, useRef } from "react";

export function PayfastAutoSubmitForm({
  actionUrl,
  fields,
}: {
  actionUrl: string;
  fields: Readonly<Record<string, string>>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current || !formRef.current) return;
    submitted.current = true;
    formRef.current.requestSubmit();
  }, []);

  return (
    <form ref={formRef} method="post" action={actionUrl} className="space-y-4">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} readOnly />
      ))}
      <p role="status" aria-live="polite" className="text-sm text-[var(--kt-text-muted)]">
        Preparing a secure handoff to Payfast. If nothing happens, use the button below.
      </p>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--kt-brand-blue)] px-5 text-sm font-extrabold text-white"
      >
        Continue to Payfast
      </button>
    </form>
  );
}
