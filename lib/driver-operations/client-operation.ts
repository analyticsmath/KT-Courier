/** Browser-only retry state with no persisted sensitive fields. */
export type DriverOperationIdStore = {
  get(action: string, materialPayload: unknown): string;
  clear(action: string): void;
};

function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${key}:${fingerprint(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function createDriverOperationIdStore(createId: () => string = () => crypto.randomUUID()): DriverOperationIdStore {
  const entries = new Map<string, { material: string; id: string }>();
  return {
    get(action, materialPayload) {
      const material = fingerprint(materialPayload);
      const current = entries.get(action);
      if (current?.material === material) return current.id;
      const id = createId();
      entries.set(action, { material, id });
      return id;
    },
    clear(action) { entries.delete(action); },
  };
}
