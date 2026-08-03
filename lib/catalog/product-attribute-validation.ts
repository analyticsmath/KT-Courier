import {
  isPlainRecord,
  type ProductAttributeDefinition,
  type ProductTypeAttributeSchema,
} from "@/lib/catalog/product-type-schema";

export type AttributeValidationIssue = { code: string; attributeCode: string };

function validScalar(definition: ProductAttributeDefinition, value: unknown): boolean {
  switch (definition.type) {
    case "TEXT":
    case "LONG_TEXT":
    case "COLOR":
      return typeof value === "string";
    case "URL":
      if (typeof value !== "string") return false;
      try { return ["https:"].includes(new URL(value).protocol); } catch { return false; }
    case "INTEGER":
      return typeof value === "number" && Number.isSafeInteger(value);
    case "DECIMAL":
      return typeof value === "number" && Number.isFinite(value);
    case "BOOLEAN":
      return typeof value === "boolean";
    case "DATE":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    case "ENUM":
      return typeof value === "string" && (definition.options ?? []).includes(value);
    case "MULTI_ENUM":
      return Array.isArray(value) && new Set(value).size === value.length && value.every((item) => typeof item === "string" && (definition.options ?? []).includes(item));
    case "MEASUREMENT":
      return isPlainRecord(value) && typeof value.value === "number" && Number.isFinite(value.value) && typeof value.unit === "string" && (!definition.unit || value.unit === definition.unit);
  }
}

function comparableNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (isPlainRecord(value) && typeof value.value === "number") return value.value;
  return null;
}

export function validateProductAttributeValues(
  schema: ProductTypeAttributeSchema,
  values: unknown,
): AttributeValidationIssue[] {
  if (!isPlainRecord(values)) return [{ code: "ATTRIBUTE_VALUES_MUST_BE_OBJECT", attributeCode: "*" }];
  const issues: AttributeValidationIssue[] = [];
  const definitions = new Map(schema.attributes.map((definition) => [definition.code, definition]));
  for (const key of Object.keys(values)) {
    if (!definitions.has(key)) issues.push({ code: "ATTRIBUTE_UNKNOWN", attributeCode: key });
  }
  for (const definition of schema.attributes) {
    const value = values[definition.code];
    if (value === undefined || value === null || value === "") {
      if (definition.required) issues.push({ code: "ATTRIBUTE_REQUIRED", attributeCode: definition.code });
      continue;
    }
    if (!validScalar(definition, value)) {
      issues.push({ code: "ATTRIBUTE_TYPE_INVALID", attributeCode: definition.code });
      continue;
    }
    const number = comparableNumber(value);
    if (number !== null && definition.minimum !== undefined && number < definition.minimum) {
      issues.push({ code: "ATTRIBUTE_BELOW_MINIMUM", attributeCode: definition.code });
    }
    if (number !== null && definition.maximum !== undefined && number > definition.maximum) {
      issues.push({ code: "ATTRIBUTE_ABOVE_MAXIMUM", attributeCode: definition.code });
    }
    if (typeof value === "string" && definition.regex) {
      const pattern = new RegExp(definition.regex, "u");
      if (!pattern.test(value)) issues.push({ code: "ATTRIBUTE_PATTERN_INVALID", attributeCode: definition.code });
    }
  }
  return issues;
}

