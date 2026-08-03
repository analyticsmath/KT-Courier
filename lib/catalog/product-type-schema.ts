export const PRODUCT_ATTRIBUTE_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "DATE",
  "ENUM",
  "MULTI_ENUM",
  "MEASUREMENT",
  "COLOR",
  "URL",
] as const;

export type ProductAttributeType = (typeof PRODUCT_ATTRIBUTE_TYPES)[number];

export type ProductAttributeDefinition = {
  code: string;
  label: string;
  helpText?: string;
  type: ProductAttributeType;
  required?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  comparable?: boolean;
  variantDefining?: boolean;
  consumerVisible?: boolean;
  unit?: string;
  minimum?: number;
  maximum?: number;
  regex?: string;
  options?: string[];
  displayOrder?: number;
};

export type ProductTypeAttributeSchema = {
  attributes: ProductAttributeDefinition[];
  requiresPrimaryImage?: boolean;
};

const ATTRIBUTE_CODE = /^[a-z][a-z0-9_]{1,63}$/;
const UNSAFE_REGEX = /(\\[1-9]|\(\?[=!<]|\{\d{4,}|\+\+|\*\*|\+\*|\*\+)/;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateProductTypeAttributeSchema(value: unknown): string[] {
  if (!isPlainRecord(value) || !Array.isArray(value.attributes)) return ["ATTRIBUTE_SCHEMA_REQUIRED"];
  const issues: string[] = [];
  const codes = new Set<string>();
  value.attributes.forEach((raw, index) => {
    if (!isPlainRecord(raw)) {
      issues.push(`ATTRIBUTE_${index}_INVALID`);
      return;
    }
    const code = typeof raw.code === "string" ? raw.code : "";
    if (!ATTRIBUTE_CODE.test(code)) issues.push(`ATTRIBUTE_${index}_CODE_INVALID`);
    if (codes.has(code)) issues.push(`ATTRIBUTE_${index}_CODE_DUPLICATE`);
    codes.add(code);
    if (typeof raw.label !== "string" || raw.label.trim().length < 1 || raw.label.length > 120) {
      issues.push(`ATTRIBUTE_${index}_LABEL_INVALID`);
    }
    if (!PRODUCT_ATTRIBUTE_TYPES.includes(raw.type as ProductAttributeType)) issues.push(`ATTRIBUTE_${index}_TYPE_INVALID`);
    if (raw.minimum !== undefined && typeof raw.minimum !== "number") issues.push(`ATTRIBUTE_${index}_MINIMUM_INVALID`);
    if (raw.maximum !== undefined && typeof raw.maximum !== "number") issues.push(`ATTRIBUTE_${index}_MAXIMUM_INVALID`);
    if (typeof raw.minimum === "number" && typeof raw.maximum === "number" && raw.minimum > raw.maximum) {
      issues.push(`ATTRIBUTE_${index}_RANGE_INVALID`);
    }
    if (raw.regex !== undefined) {
      if (typeof raw.regex !== "string" || raw.regex.length > 200 || UNSAFE_REGEX.test(raw.regex)) {
        issues.push(`ATTRIBUTE_${index}_REGEX_UNSAFE`);
      } else {
        try { new RegExp(raw.regex, "u"); } catch { issues.push(`ATTRIBUTE_${index}_REGEX_INVALID`); }
      }
    }
    if ((raw.type === "ENUM" || raw.type === "MULTI_ENUM") && (!Array.isArray(raw.options) || raw.options.length < 1)) {
      issues.push(`ATTRIBUTE_${index}_OPTIONS_REQUIRED`);
    }
    if (Array.isArray(raw.options)) {
      const options = raw.options.filter((option): option is string => typeof option === "string");
      if (options.length !== raw.options.length || new Set(options).size !== options.length || options.length > 200) {
        issues.push(`ATTRIBUTE_${index}_OPTIONS_INVALID`);
      }
    }
  });
  return issues;
}

export function assertProductTypeSchemaBundle(value: {
  attributeSchema: unknown;
  variantSchema: unknown;
  complianceSchema: unknown;
  searchFacetSchema: unknown;
}): void {
  const issues = validateProductTypeAttributeSchema(value.attributeSchema);
  for (const [name, schema] of Object.entries(value)) {
    if (!isPlainRecord(schema)) issues.push(`${name.toUpperCase()}_MUST_BE_OBJECT`);
  }
  if (issues.length > 0) throw new Error(`Invalid product-type schema: ${issues.join(", ")}`);
}

