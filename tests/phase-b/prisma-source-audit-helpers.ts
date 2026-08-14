/**
 * Prisma's formatter aligns model columns for readability. Source audits
 * should therefore inspect model declarations semantically, not by their
 * cosmetic column padding.
 */
export function normalizePrismaSource(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract one complete Prisma model block without relying on field spacing. */
export function readPrismaModel(schema: string, modelName: string): string {
  const declaration = new RegExp(`(?:^|\\n)model\\s+${escapeRegExp(modelName)}\\s*\\{`, "m").exec(schema);
  if (!declaration) throw new Error(`Prisma model not found: ${modelName}`);

  const openingBrace = schema.indexOf("{", declaration.index);
  let depth = 1;
  for (let index = openingBrace + 1; index < schema.length; index += 1) {
    if (schema[index] === "{") depth += 1;
    if (schema[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return schema.slice(openingBrace + 1, index);
  }

  throw new Error(`Unclosed Prisma model: ${modelName}`);
}

/**
 * Returns true only when a declaration line contains the requested field,
 * scalar/type expression, and optional attribute prefix.
 */
export function hasPrismaField(
  schema: string,
  modelName: string,
  fieldName: string,
  declaration: string,
): boolean {
  const model = normalizePrismaSource(readPrismaModel(schema, modelName));
  const expected = `${fieldName} ${declaration}`;
  return model.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed === expected || trimmed.startsWith(`${expected} `);
  });
}
