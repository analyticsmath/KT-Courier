"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { isPlainRecord, type ProductAttributeDefinition } from "@/lib/catalog/product-type-schema";

export type ComplianceRequirementSchema = {
  code: string;
  label?: string;
  description?: string;
  required?: boolean;
  appliesToConditions?: string[];
};

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function extractAttributeDefinitions(
  attributeSchema: unknown,
): ProductAttributeDefinition[] {
  if (!isPlainRecord(attributeSchema) || !Array.isArray(attributeSchema.attributes)) {
    return [];
  }
  return attributeSchema.attributes.filter(
    (item): item is ProductAttributeDefinition =>
      isPlainRecord(item) && typeof item.code === "string" && typeof item.label === "string",
  );
}

export function extractComplianceRequirements(
  complianceSchema: unknown,
): ComplianceRequirementSchema[] {
  if (!isPlainRecord(complianceSchema) || !Array.isArray(complianceSchema.requirements)) {
    return [];
  }
  return complianceSchema.requirements.filter(
    (item): item is ComplianceRequirementSchema =>
      isPlainRecord(item) && typeof item.code === "string",
  );
}

export function CatalogSchemaAttributeFields({
  attributeSchema,
  productTypeCode,
  rawJson,
  onChangeJson,
}: {
  attributeSchema: unknown;
  productTypeCode?: string;
  rawJson: string;
  onChangeJson: (next: string) => void;
}) {
  const definitions = extractAttributeDefinitions(attributeSchema);
  const parsed = parseJsonObject(rawJson);

  function updateField(code: string, nextValue: unknown) {
    const base = { ...(parsed ?? {}) };
    if (
      nextValue === "" ||
      nextValue === undefined ||
      (Array.isArray(nextValue) && nextValue.length === 0)
    ) {
      delete base[code];
    } else {
      base[code] = nextValue;
    }
    onChangeJson(JSON.stringify(base, null, 2));
  }

  return (
    <div className="space-y-4">
      {definitions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {definitions.map((attr) => {
            const inputId = `attr-${attr.code}`;
            const current = parsed?.[attr.code];
            const labelText = `${attr.label}${attr.required ? " (required)" : ""}`;

            if (attr.type === "BOOLEAN") {
              return (
                <div key={attr.code} className="flex flex-col justify-center rounded-lg border border-[var(--kt-soft-border)] p-3 sm:col-span-2">
                  <label htmlFor={inputId} className="flex min-h-11 items-center gap-3 text-sm font-bold">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={current === true}
                      onChange={(event) =>
                        updateField(attr.code, event.target.checked ? true : undefined)
                      }
                    />
                    <span>{labelText}</span>
                  </label>
                  {attr.helpText ? (
                    <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                  ) : null}
                </div>
              );
            }

            if (attr.type === "ENUM") {
              return (
                <div key={attr.code} className="min-w-0">
                  <label htmlFor={inputId} className="mb-1 block text-sm font-extrabold">
                    {labelText}
                  </label>
                  <Select
                    id={inputId}
                    value={typeof current === "string" ? current : ""}
                    onChange={(event) => updateField(attr.code, event.target.value)}
                    placeholder={`Select ${attr.label.toLocaleLowerCase("en-ZA")}`}
                    options={(attr.options ?? []).map((opt) => ({ value: opt, label: opt }))}
                  />
                  {attr.helpText ? (
                    <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                  ) : null}
                </div>
              );
            }

            if (attr.type === "MULTI_ENUM") {
              const selected = Array.isArray(current)
                ? current.filter((v): v is string => typeof v === "string")
                : [];
              return (
                <fieldset key={attr.code} className="space-y-2 rounded-lg border border-[var(--kt-soft-border)] p-3 sm:col-span-2">
                  <legend className="px-1 text-sm font-extrabold">{labelText}</legend>
                  <div className="flex flex-wrap gap-3">
                    {(attr.options ?? []).map((opt) => {
                      const checked = selected.includes(opt);
                      return (
                        <label key={opt} className="inline-flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...selected, opt]
                                : selected.filter((item) => item !== opt);
                              updateField(attr.code, next);
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                  {attr.helpText ? (
                    <p className="text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                  ) : null}
                </fieldset>
              );
            }

            if (attr.type === "LONG_TEXT") {
              return (
                <div key={attr.code} className="min-w-0 sm:col-span-2">
                  <label htmlFor={inputId} className="mb-1 block text-sm font-extrabold">
                    {labelText}
                  </label>
                  <Textarea
                    id={inputId}
                    rows={3}
                    value={typeof current === "string" ? current : ""}
                    onChange={(event) => updateField(attr.code, event.target.value)}
                  />
                  {attr.helpText ? (
                    <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                  ) : null}
                </div>
              );
            }

            if (attr.type === "INTEGER" || attr.type === "DECIMAL") {
              return (
                <div key={attr.code} className="min-w-0">
                  <label htmlFor={inputId} className="mb-1 block text-sm font-extrabold">
                    {labelText}
                    {attr.unit ? ` (${attr.unit})` : ""}
                  </label>
                  <Input
                    id={inputId}
                    inputMode={attr.type === "INTEGER" ? "numeric" : "decimal"}
                    value={typeof current === "number" ? String(current) : ""}
                    onChange={(event) => {
                      const trimmed = event.target.value.trim();
                      if (!trimmed) {
                        updateField(attr.code, undefined);
                        return;
                      }
                      const num = Number(trimmed);
                      if (
                        Number.isFinite(num) &&
                        (attr.type !== "INTEGER" || Number.isSafeInteger(num))
                      ) {
                        updateField(attr.code, num);
                      }
                    }}
                  />
                  {attr.helpText ? (
                    <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                  ) : null}
                </div>
              );
            }

            if (attr.type === "MEASUREMENT") {
              const meas = isPlainRecord(current) ? current : null;
              return (
                <div key={attr.code} className="min-w-0">
                  <label htmlFor={inputId} className="mb-1 block text-sm font-extrabold">
                    {labelText}
                    {attr.unit ? ` (${attr.unit})` : ""}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id={inputId}
                      inputMode="decimal"
                      value={typeof meas?.value === "number" ? String(meas.value) : ""}
                      onChange={(event) => {
                        const trimmed = event.target.value.trim();
                        if (!trimmed) {
                          updateField(attr.code, undefined);
                          return;
                        }
                        const num = Number(trimmed);
                        if (Number.isFinite(num)) {
                          updateField(attr.code, {
                            value: num,
                            unit: attr.unit || (typeof meas?.unit === "string" ? meas.unit : "unit"),
                          });
                        }
                      }}
                    />
                    {attr.unit ? (
                      <span className="inline-flex min-h-11 items-center rounded-lg border border-[var(--kt-soft-border)] px-3 text-xs font-semibold">
                        {attr.unit}
                      </span>
                    ) : null}
                  </div>
                  {attr.helpText ? (
                    <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={attr.code} className="min-w-0">
                <label htmlFor={inputId} className="mb-1 block text-sm font-extrabold">
                  {labelText}
                </label>
                <Input
                  id={inputId}
                  type={attr.type === "DATE" ? "date" : attr.type === "URL" ? "url" : "text"}
                  value={typeof current === "string" ? current : ""}
                  onChange={(event) => updateField(attr.code, event.target.value)}
                />
                {attr.helpText ? (
                  <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{attr.helpText}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[var(--kt-text-muted)]">
          No extra typed attributes are required for{" "}
          {productTypeCode ? `product type ${productTypeCode}` : "the selected category"}.
        </p>
      )}

      <details className="rounded-lg border border-[var(--kt-soft-border)] p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Advanced attribute values JSON
        </summary>
        <div className="mt-3">
          <label htmlFor="attribute-values" className="mb-1 block text-sm font-extrabold">
            Attribute values
          </label>
          <Textarea
            id="attribute-values"
            value={rawJson}
            onChange={(event) => onChangeJson(event.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-[var(--kt-text-muted)]">
            Schema-driven JSON for {productTypeCode ?? "the selected product type"}. Unknown fields are rejected.
          </p>
        </div>
      </details>
    </div>
  );
}

export function CatalogSchemaComplianceFields({
  complianceSchema,
  rawJson,
  onChangeJson,
}: {
  complianceSchema: unknown;
  rawJson: string;
  onChangeJson: (next: string) => void;
}) {
  const requirements = extractComplianceRequirements(complianceSchema);
  const parsed = parseJsonObject(rawJson);

  function updateField(code: string, nextValue: string) {
    const base = { ...(parsed ?? {}) };
    if (!nextValue.trim()) {
      delete base[code];
    } else {
      base[code] = nextValue;
    }
    onChangeJson(JSON.stringify(base, null, 2));
  }

  return (
    <div className="space-y-4">
      {requirements.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {requirements.map((req) => {
            const id = `compliance-${req.code}`;
            const current = parsed?.[req.code];
            return (
              <div key={req.code} className="min-w-0">
                <label htmlFor={id} className="mb-1 block text-sm font-extrabold">
                  {req.label || req.code.replaceAll("_", " ")}
                  {req.required ? " (required)" : ""}
                </label>
                <Input
                  id={id}
                  value={typeof current === "string" ? current : ""}
                  onChange={(event) => updateField(req.code, event.target.value)}
                />
                {req.description ? (
                  <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{req.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="compliance-origin" className="mb-1 block text-sm font-extrabold">
              Country of origin / maker (optional)
            </label>
            <Input
              id="compliance-origin"
              placeholder="e.g. South Africa"
              value={typeof parsed?.country_of_origin === "string" ? parsed.country_of_origin : ""}
              onChange={(event) => updateField("country_of_origin", event.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="compliance-allergens" className="mb-1 block text-sm font-extrabold">
              Allergens, ingredients or care note (optional)
            </label>
            <Input
              id="compliance-allergens"
              placeholder="e.g. Contains wheat and dairy"
              value={typeof parsed?.safety_disclosure === "string" ? parsed.safety_disclosure : ""}
              onChange={(event) => updateField("safety_disclosure", event.target.value)}
            />
          </div>
        </div>
      )}

      <details className="rounded-lg border border-[var(--kt-soft-border)] p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Advanced compliance values JSON
        </summary>
        <div className="mt-3">
          <label htmlFor="compliance-values" className="mb-1 block text-sm font-extrabold">
            Compliance values
          </label>
          <Textarea
            id="compliance-values"
            value={rawJson}
            onChange={(event) => onChangeJson(event.target.value)}
            rows={5}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-[var(--kt-text-muted)]">
            Ingredients, allergens, origin, condition and restriction evidence are validated before submission.
          </p>
        </div>
      </details>
    </div>
  );
}
