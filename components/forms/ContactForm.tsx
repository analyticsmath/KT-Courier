"use client";

import { useState } from "react";
import styles from "./ContactForm.module.css";

const enquiryTypes = [
  { value: "delivery_question", label: "Delivery question" },
  { value: "business_account", label: "Business account" },
  { value: "existing_order", label: "Existing order" },
  { value: "pricing", label: "Pricing" },
  { value: "general_support", label: "General support" },
] as const;

type FieldName = "name" | "email" | "phone" | "enquiryType" | "message";

type FieldErrors = Partial<Record<FieldName, string>>;

const fieldIds: Record<FieldName, string> = {
  name: "contact-name",
  email: "contact-email",
  phone: "contact-phone",
  enquiryType: "contact-enquiry-type",
  message: "contact-message",
};

function errorId(field: FieldName): string {
  return `${fieldIds[field]}-error`;
}

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const body = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      enquiryType: formData.get("enquiry_type") as string,
      message: formData.get("message") as string,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string; fields?: FieldErrors };

      if (!response.ok || data.error) {
        if (data.fields) {
          setFieldErrors(data.fields);
        } else {
          // The public form never renders an arbitrary server failure payload.
          setFormError("We could not send your enquiry. Please try again.");
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setFormError("We could not send your enquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <section aria-labelledby="contact-success-heading" className={styles.success} role="status">
        <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
          <path d="m5 12 4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
        <div>
          <h3 id="contact-success-heading">Message received</h3>
          <p>KT Couriers will respond as soon as possible during operating hours.</p>
        </div>
      </section>
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {formError ? (
        <div className={styles.errorSummary} role="alert" tabIndex={-1}>
          <p>{formError}</p>
        </div>
      ) : null}

      <div className={styles.field}>
        <label htmlFor={fieldIds.name}>Name <span aria-hidden="true">*</span></label>
        <input
          aria-describedby={fieldErrors.name ? errorId("name") : undefined}
          aria-invalid={Boolean(fieldErrors.name)}
          autoComplete="name"
          id={fieldIds.name}
          name="name"
          required
          type="text"
        />
        {fieldErrors.name ? <p className={styles.fieldError} id={errorId("name")}>{fieldErrors.name}</p> : null}
      </div>

      <div className={styles.twoColumns}>
        <div className={styles.field}>
          <label htmlFor={fieldIds.email}>Email address <span aria-hidden="true">*</span></label>
          <input
            aria-describedby={fieldErrors.email ? errorId("email") : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoCapitalize="none"
            autoComplete="email"
            id={fieldIds.email}
            name="email"
            required
            spellCheck={false}
            type="email"
          />
          {fieldErrors.email ? <p className={styles.fieldError} id={errorId("email")}>{fieldErrors.email}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={fieldIds.phone}>Phone number <span className={styles.optional}>(optional)</span></label>
          <input
            aria-describedby={fieldErrors.phone ? errorId("phone") : undefined}
            aria-invalid={Boolean(fieldErrors.phone)}
            autoComplete="tel"
            id={fieldIds.phone}
            name="phone"
            type="tel"
          />
          {fieldErrors.phone ? <p className={styles.fieldError} id={errorId("phone")}>{fieldErrors.phone}</p> : null}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={fieldIds.enquiryType}>Enquiry type <span aria-hidden="true">*</span></label>
        <select
          aria-describedby={fieldErrors.enquiryType ? errorId("enquiryType") : undefined}
          aria-invalid={Boolean(fieldErrors.enquiryType)}
          defaultValue=""
          id={fieldIds.enquiryType}
          name="enquiry_type"
          required
        >
          <option disabled value="">Select enquiry type</option>
          {enquiryTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        {fieldErrors.enquiryType ? <p className={styles.fieldError} id={errorId("enquiryType")}>{fieldErrors.enquiryType}</p> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={fieldIds.message}>Message <span aria-hidden="true">*</span></label>
        <textarea
          aria-describedby={fieldErrors.message ? errorId("message") : undefined}
          aria-invalid={Boolean(fieldErrors.message)}
          id={fieldIds.message}
          name="message"
          required
          rows={5}
        />
        {fieldErrors.message ? <p className={styles.fieldError} id={errorId("message")}>{fieldErrors.message}</p> : null}
      </div>

      <button disabled={loading} type="submit">
        {loading ? "Sending enquiry…" : "Send enquiry"}
      </button>
      <p className={styles.helpText}>Please include only the information needed to answer your enquiry.</p>
    </form>
  );
}
