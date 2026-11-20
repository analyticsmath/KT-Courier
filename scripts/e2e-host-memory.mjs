/** Bound a caller-selected heap without allowing arbitrary Node options. */
export function resolveHostHeapMb(value) {
  if (value === undefined) return 2500;
  if (!/^\d+$/.test(value)) throw new Error("KT_E2E_HOST_HEAP_MB must be an integer between 2500 and 8192.");
  const heap = Number(value);
  if (!Number.isSafeInteger(heap) || heap < 2500 || heap > 8192) throw new Error("KT_E2E_HOST_HEAP_MB must be an integer between 2500 and 8192.");
  return heap;
}
