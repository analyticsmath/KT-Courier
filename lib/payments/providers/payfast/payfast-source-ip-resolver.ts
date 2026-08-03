import { promises as dns } from "node:dns";
import { PaymentError } from "@/lib/payments/errors";
import type { PaymentProviderEnvironment } from "@/lib/payments/types";
import { normalizePayfastSourceAddress } from "./payfast-source-address";
import { PAYFAST_SOURCE_HOSTS } from "./payfast-source-hosts";

type DnsRecord = Readonly<{ address: string; ttl: number }>;
export type PayfastDnsClient = Readonly<{
  resolve4(hostname: string): Promise<readonly DnsRecord[]>;
  resolve6(hostname: string): Promise<readonly DnsRecord[]>;
}>;
type CacheEntry = Readonly<{ addresses: ReadonlySet<string>; refreshAt: number; expiresAt: number; staleUntil: number }>;

const MIN_CACHE_MS = 30_000;
const MAX_CACHE_MS = 5 * 60_000;
const STALE_GRACE_MS = 60_000;
const MAX_SOURCE_ADDRESSES = 128;

const productionDns: PayfastDnsClient = Object.freeze({
  resolve4: (hostname) => dns.resolve4(hostname, { ttl: true }),
  resolve6: (hostname) => dns.resolve6(hostname, { ttl: true }),
});

export class PayfastSourceIpResolver {
  readonly #cache = new Map<PaymentProviderEnvironment, CacheEntry>();

  constructor(
    private readonly dnsClient: PayfastDnsClient = productionDns,
    private readonly clock: () => number = Date.now,
  ) {}

  async resolve(environment: PaymentProviderEnvironment): Promise<ReadonlySet<string>> {
    const now = this.clock();
    const cached = this.#cache.get(environment);
    if (cached && cached.refreshAt > now) return cached.addresses;

    try {
      const addresses = new Set<string>();
      let smallestTtlSeconds = MAX_CACHE_MS / 1_000;
      for (const hostname of PAYFAST_SOURCE_HOSTS[environment]) {
        const [v4, v6] = await Promise.allSettled([
          this.dnsClient.resolve4(hostname),
          this.dnsClient.resolve6(hostname),
        ]);
        const records = [
          ...(v4.status === "fulfilled" ? v4.value : []),
          ...(v6.status === "fulfilled" ? v6.value : []),
        ];
        if (records.length === 0) throw new Error(`No address records for ${hostname}`);
        for (const record of records) {
          addresses.add(normalizePayfastSourceAddress(record.address));
          if (Number.isFinite(record.ttl) && record.ttl > 0) smallestTtlSeconds = Math.min(smallestTtlSeconds, record.ttl);
          if (addresses.size > MAX_SOURCE_ADDRESSES) throw new Error("Payfast DNS result set exceeded its bound.");
        }
      }
      if (addresses.size === 0) throw new Error("Payfast DNS set is empty.");
      const lifetime = Math.min(MAX_CACHE_MS, Math.max(MIN_CACHE_MS, smallestTtlSeconds * 1_000));
      const entry = Object.freeze({
        addresses: addresses as ReadonlySet<string>,
        refreshAt: now + Math.floor(lifetime * 0.8),
        expiresAt: now + lifetime,
        staleUntil: now + lifetime + STALE_GRACE_MS,
      });
      this.#cache.set(environment, entry);
      return entry.addresses;
    } catch (error) {
      if (cached && cached.staleUntil > now) return cached.addresses;
      throw new PaymentError("PAYFAST_SOURCE_DNS_UNAVAILABLE", "Payfast source verification is temporarily unavailable.", true, { cause: error });
    }
  }

  async verify(environment: PaymentProviderEnvironment, sourceAddress: string): Promise<void> {
    const addresses = await this.resolve(environment);
    if (!addresses.has(sourceAddress)) throw new PaymentError("PAYFAST_SOURCE_NOT_ALLOWED", "Payfast source address is not allowlisted.");
  }
}

export const payfastSourceIpResolver = new PayfastSourceIpResolver();
