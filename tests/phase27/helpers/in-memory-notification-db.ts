/* eslint-disable @typescript-eslint/no-explicit-any -- controlled Phase 27 test double. */
type Row = Record<string, any>;
type State = Record<string, Row[]>;

const compound: Record<string, string[]> = {
  sourceAuthority_sourceEventId: ["sourceAuthority", "sourceEventId"],
  sourceAuthority_sourceEventType: ["sourceAuthority", "sourceEventType"],
  userId_categoryKey_channel: ["userId", "categoryKey", "channel"],
  provider_providerReceiptId: ["provider", "providerReceiptId"],
  messageId_channel: ["messageId", "channel"],
};
const unique: Record<string, string[][]> = {
  notificationSourceReceipt: [["sourceAuthority", "sourceEventId"]], notificationMessage: [["dedupeKey"]], notificationDelivery: [["messageId", "channel"]], notificationDeliveryAttempt: [["deliveryId", "attemptNumber"], ["operationId"]], notificationProviderReceipt: [["provider", "providerReceiptId"]], notificationEndpoint: [["fingerprint"]], notificationInboxItem: [["messageId"]], notificationEventIntent: [["operationId"]], notificationSecurePayload: [["eventIntentId"]], notificationCategory: [["key"], ["publicReference"]], notificationTemplate: [["key"], ["publicReference"]], notificationTemplateVersion: [["templateId", "versionNumber"], ["publicReference"]], notificationEventRoute: [["sourceAuthority", "sourceEventType"], ["key"], ["publicReference"]], notificationEventRouteVersion: [["routeId", "versionNumber"], ["publicReference"]], notificationRecipient: [["messageId", "subjectUserId"]], notificationRecipientPolicyVersion: [["key", "versionNumber"], ["publicReference"]], notificationDigestBucket: [["publicReference"]], notificationSuppression: [["publicReference"]], notificationReconciliationCase: [["publicReference"]],
};

function matches(row: Row, where: any = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return (expected as any[]).some((child) => matches(row, child));
    if (key === "AND") return (expected as any[]).every((child) => matches(row, child));
    const fields = compound[key];
    if (fields) return fields.every((field) => row[field] === (expected as Row)[field]);
    const value = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
      const exp = expected as any;
      if ("in" in exp) return (exp.in as unknown[]).includes(value);
      if ("gt" in exp) return value > exp.gt;
      if ("gte" in exp) return value >= exp.gte;
      if ("lt" in exp) return value < exp.lt;
      if ("lte" in exp) return value <= exp.lte;
      if ("contains" in exp) return String(value).includes(String(exp.contains));
      return Object.entries(exp).every(([nestedKey, nestedValue]) => value?.[nestedKey] === nestedValue);
    }
    return value === expected;
  });
}

function order(rows: Row[], orderBy: any) {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return rows.sort((left, right) => {
    for (const descriptor of orders) {
      const [key, direction] = Object.entries(descriptor ?? {})[0] ?? [];
      if (!key || left[key] === right[key]) continue;
      return (left[key] > right[key] ? 1 : -1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
}

function project(row: Row, select: any) {
  if (!select) return row;
  return Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([key]) => [key, row[key]]));
}

export function createNotificationMemoryDb(seed: Partial<State> = {}) {
  const modelNames = ["notificationCategory", "notificationTemplate", "notificationTemplateVersion", "notificationTemplateVariable", "notificationEventRoute", "notificationEventRouteVersion", "notificationRecipientPolicyVersion", "notificationSourceReceipt", "notificationMessage", "notificationRecipient", "notificationDelivery", "notificationDeliveryAttempt", "notificationProviderReceipt", "notificationInboxItem", "notificationPreference", "notificationConsentRecord", "notificationEndpoint", "notificationSuppression", "notificationDigestBucket", "notificationAuditEvent", "notificationReconciliationCase", "notificationEventIntent", "notificationSecurePayload", "user"];
  const state: State = Object.fromEntries(modelNames.map((name) => [name, (seed[name] ?? []).map((row) => ({ ...row }))]));
  let sequence = 0;
  const db: any = { __state: state };
  for (const name of modelNames) {
    db[name] = {
      findUnique: async ({ where, select }: any) => { const row = state[name].find((candidate) => matches(candidate, where)); return row ? project(row, select) : null; },
      findUniqueOrThrow: async ({ where, select }: any) => { const row = state[name].find((candidate) => matches(candidate, where)); if (!row) throw new Error(`${name} not found`); return project(row, select); },
      findFirst: async ({ where, orderBy, select }: any = {}) => { const rows = state[name].filter((candidate) => matches(candidate, where)); const row = order(rows, orderBy)[0]; return row ? project(row, select) : null; },
      findMany: async ({ where, orderBy, skip = 0, take, select }: any = {}) => order(state[name].filter((candidate) => matches(candidate, where)).slice(), orderBy).slice(skip, take === undefined ? undefined : skip + take).map((row) => project(row, select)),
      count: async ({ where }: any = {}) => state[name].filter((candidate) => matches(candidate, where)).length,
      create: async ({ data }: any) => { for (const fields of unique[name] ?? []) if (state[name].some((candidate) => fields.every((field) => candidate[field] === data[field]))) { const error: any = new Error("Unique constraint"); error.code = "P2002"; throw error; } const row = { id: data.id ?? `${name}_${++sequence}`, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date(), ...data }; state[name].push(row); return row; },
      createMany: async ({ data }: any) => { for (const item of data) await db[name].create({ data: item }); return { count: data.length }; },
      update: async ({ where, data }: any) => { const row = state[name].find((candidate) => matches(candidate, where)); if (!row) throw new Error(`${name} not found`); for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "increment" in value ? (row[key] ?? 0) + Number(value.increment) : value; row.updatedAt = new Date(); return row; },
      updateMany: async ({ where, data }: any) => { const rows = state[name].filter((candidate) => matches(candidate, where)); for (const row of rows) for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "increment" in value ? (row[key] ?? 0) + Number(value.increment) : value; return { count: rows.length }; },
      upsert: async ({ where, create, update }: any) => { const current = state[name].find((candidate) => matches(candidate, where)); return current ? db[name].update({ where: { id: current.id }, data: update }) : db[name].create({ data: create }); },
    };
  }
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => {
    const snapshot = structuredClone(state);
    try { return await callback(db); } catch (error) { for (const key of Object.keys(state)) state[key] = snapshot[key]; throw error; }
  };
  return db;
}
