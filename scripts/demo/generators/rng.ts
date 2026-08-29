/**
 * KT Couriers — Deterministic PRNG for Seed Orchestration
 */

export class SeededRNG {
  private s: number;

  constructor(seed = 123456789) {
    this.s = seed;
  }

  /** Return float [0, 1) */
  next(): number {
    this.s = (this.s * 9301 + 49297) % 233280;
    return this.s / 233280;
  }

  /** Return integer [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Pick random element from array */
  element<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error("Cannot pick from empty array");
    return array[Math.floor(this.next() * array.length)]!;
  }

  /** Pick multiple unique elements from array */
  sample<T>(array: readonly T[], count: number): T[] {
    const copy = [...array];
    const result: T[] = [];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * copy.length);
      result.push(copy.splice(idx, 1)[0]!);
    }
    return result;
  }

  /** Return boolean with given probability */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Return float [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export const defaultRng = new SeededRNG(42);
