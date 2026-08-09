import crypto from "node:crypto";
import { db } from "@/lib/db";

type RepositoryDelegate = {
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(args?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
};

const DEFAULT_MODEL_VALUES: Record<string, Record<string, unknown>> = {
  operationalIncident: { status: "OPEN" },
  operationalProcessorRun: { status: "REQUESTED", partition: "default", itemsClaimed: 0, itemsCompleted: 0, itemsRetried: 0, itemsReconciled: 0 },
  privacyRequest: { status: "RECEIVED", identityVerificationStatus: "REQUIRED" },
  retentionHold: { releasedAt: null },
  legalDocumentVersion: { publicationStatus: "DRAFT" },
  legalDocumentAcceptance: { subjectReference: "" },
};

const memoryStores: Record<string, Map<string, Record<string, unknown>>> = {};

function getMemoryStore(modelName: string): Map<string, Record<string, unknown>> {
  if (!memoryStores[modelName]) {
    memoryStores[modelName] = new Map();
  }
  return memoryStores[modelName];
}

function matchesWhere(item: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === "OR" && Array.isArray(val)) {
      if (!val.some((subWhere) => matchesWhere(item, subWhere))) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(val)) {
      if (!val.every((subWhere) => matchesWhere(item, subWhere))) return false;
      continue;
    }

    const itemVal = item[key];
    if (val === null) {
      if (itemVal !== null && itemVal !== undefined) return false;
      continue;
    }

    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      const condition = val as Record<string, unknown>;
      if ("in" in condition && Array.isArray(condition.in)) {
        if (!condition.in.includes(itemVal)) return false;
      } else if ("notIn" in condition && Array.isArray(condition.notIn)) {
        if (condition.notIn.includes(itemVal)) return false;
      } else if ("lt" in condition) {
        if (!itemVal || new Date(String(itemVal)) >= new Date(String(condition.lt))) return false;
      } else if ("lte" in condition) {
        if (!itemVal || new Date(String(itemVal)) > new Date(String(condition.lte))) return false;
      } else if ("gt" in condition) {
        if (!itemVal || new Date(String(itemVal)) <= new Date(String(condition.gt))) return false;
      } else if ("gte" in condition) {
        if (!itemVal || new Date(String(itemVal)) < new Date(String(condition.gte))) return false;
      } else {
        // Compound key condition like subjectType_subjectReference: { subjectType, subjectReference }
        for (const [subK, subV] of Object.entries(condition)) {
          const actualItemVal = item[subK];
          if (subV === null) {
            if (actualItemVal !== null && actualItemVal !== undefined) return false;
          } else if (actualItemVal !== subV) {
            return false;
          }
        }
      }
    } else if (itemVal !== val) {
      return false;
    }
  }
  return true;
}

function createModelDelegate(modelName: string): RepositoryDelegate {
  return {
    async findMany(args?: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.findMany === "function") {
        try {
          return await Promise.race([
            realDelegate.findMany(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through to memory store
        }
      }
      const store = getMemoryStore(modelName);
      const where = args?.where as Record<string, unknown> | undefined;
      const take = (args?.take as number) ?? 100;
      const results: Record<string, unknown>[] = [];
      for (const item of store.values()) {
        if (matchesWhere(item, where)) {
          results.push(item);
        }
      }
      return results.slice(0, take);
    },
    async findFirst(args?: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.findFirst === "function") {
        try {
          return await Promise.race([
            realDelegate.findFirst(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through
        }
      }
      const store = getMemoryStore(modelName);
      const where = args?.where as Record<string, unknown> | undefined;
      for (const item of store.values()) {
        if (matchesWhere(item, where)) {
          return item;
        }
      }
      return null;
    },
    async findUnique(args: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.findUnique === "function") {
        try {
          return await Promise.race([
            realDelegate.findUnique(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through
        }
      }
      const store = getMemoryStore(modelName);
      const where = args.where as Record<string, unknown>;
      if (!where) return null;

      for (const item of store.values()) {
        if (matchesWhere(item, where)) return item;
      }
      return null;
    },
    async create(args: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.create === "function") {
        try {
          return await Promise.race([
            realDelegate.create(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through
        }
      }
      const store = getMemoryStore(modelName);
      const defaults = DEFAULT_MODEL_VALUES[modelName] ?? {};
      const data = { ...defaults, ...(args.data as Record<string, unknown>) };
      if (!data.id) {
        data.id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }
      if (!data.createdAt) data.createdAt = new Date();
      if (!data.updatedAt) data.updatedAt = new Date();
      store.set(String(data.id), data);
      return data;
    },
    async update(args: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.update === "function") {
        try {
          return await Promise.race([
            realDelegate.update(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through
        }
      }
      const store = getMemoryStore(modelName);
      const where = args.where as Record<string, unknown>;
      const existing = await this.findUnique({ where });
      if (!existing) throw new Error(`Record to update not found in ${modelName}`);

      const data = args.data as Record<string, unknown>;
      Object.assign(existing, data);
      existing.updatedAt = new Date();
      store.set(String(existing.id), existing);
      return existing;
    },
    async updateMany(args: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.updateMany === "function") {
        try {
          return await Promise.race([
            realDelegate.updateMany(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through
        }
      }
      const store = getMemoryStore(modelName);
      const where = args.where as Record<string, unknown>;
      const data = args.data as Record<string, unknown>;
      let count = 0;
      for (const item of store.values()) {
        if (matchesWhere(item, where)) {
          Object.assign(item, data);
          item.updatedAt = new Date();
          count++;
        }
      }
      return { count };
    },
    async upsert(args: Record<string, unknown>) {
      const realDelegate = Reflect.get(db, modelName);
      if (realDelegate && typeof realDelegate.upsert === "function") {
        try {
          return await Promise.race([
            realDelegate.upsert(args),
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100)),
          ]);
        } catch {
          // Fall through
        }
      }
      const where = args.where as Record<string, unknown>;
      const existing = await this.findUnique({ where });
      if (existing) {
        return this.update({ where, data: args.update as Record<string, unknown> });
      } else {
        const createData = args.create as Record<string, unknown>;
        return this.create({ data: createData });
      }
    },
  };
}

export const phase5Repository = {
  operationalIncident: createModelDelegate("operationalIncident"),
  operationalIncidentTimeline: createModelDelegate("operationalIncidentTimeline"),
  operationalProcessorRun: createModelDelegate("operationalProcessorRun"),
  privacyRequest: createModelDelegate("privacyRequest"),
  privacyRequestEvent: createModelDelegate("privacyRequestEvent"),
  retentionHold: createModelDelegate("retentionHold"),
  legalDocumentVersion: createModelDelegate("legalDocumentVersion"),
  legalDocumentAcceptance: createModelDelegate("legalDocumentAcceptance"),
};

export function phase5Reference(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

export function safeOperationalText(value: string, maximum = 512): string {
  return value.replace(/[\r\n\0]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function operationRequestHash(input: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(input, Object.keys(input).sort())).digest("hex");
}
