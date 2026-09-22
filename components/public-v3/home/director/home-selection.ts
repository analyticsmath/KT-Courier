/**
 * Keeps scroll-driven visual sampling separate from semantic React/storage
 * updates. The director can call this for every frame without churning state.
 */
export function commitSelection(currentId: string | undefined, nextId: string | undefined, emit?: (id: string) => void): string | undefined {
  if (!nextId || nextId === currentId) return currentId;
  emit?.(nextId);
  return nextId;
}

/** Persistence never overrides a live in-memory selection. */
export function resolvePersistedProductId(selectedId: string | undefined, persistedId: string | null | undefined, productIds: readonly string[]): string | undefined {
  if (selectedId && productIds.includes(selectedId)) return selectedId;
  if (persistedId && productIds.includes(persistedId)) return persistedId;
  return productIds[0];
}
