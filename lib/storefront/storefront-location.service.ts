import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { StorefrontLocationContext } from "@/lib/storefront/storefront-types";

export const STOREFRONT_LOCATION_COOKIE = "kt_storefront_area";
const MAX_CONTEXT_AGE_SECONDS = 60 * 60 * 24 * 30;
const SAFE_REFERENCE = /^[a-z0-9][a-z0-9-]{0,95}$/;

type StoredLocation = { area: string; status: "RESOLVED" | "UNSUPPORTED"; issuedAt: number };

function locationSecret(): string {
  const secret = process.env.STOREFRONT_LOCATION_CONTEXT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Storefront location context is unavailable.");
  return secret;
}
function sign(value: string): string { return createHmac("sha256", locationSecret()).update(value).digest("base64url"); }

export function encodeStorefrontLocationContext(value: StoredLocation): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function readStorefrontLocationContext(value: string | undefined): StorefrontLocationContext {
  if (!value) return { serviceAreaReference: null, resolutionStatus: "UNKNOWN" };
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return { serviceAreaReference: null, resolutionStatus: "UNKNOWN" };
  try {
    const expected = Buffer.from(sign(payload)); const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { serviceAreaReference: null, resolutionStatus: "UNKNOWN" };
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StoredLocation;
    if (!SAFE_REFERENCE.test(parsed.area) || !["RESOLVED", "UNSUPPORTED"].includes(parsed.status) || !Number.isSafeInteger(parsed.issuedAt) || Date.now() - parsed.issuedAt > MAX_CONTEXT_AGE_SECONDS * 1000) return { serviceAreaReference: null, resolutionStatus: "UNKNOWN" };
    return { serviceAreaReference: parsed.status === "RESOLVED" ? parsed.area : null, resolutionStatus: parsed.status };
  } catch { return { serviceAreaReference: null, resolutionStatus: "UNKNOWN" }; }
}

export async function listStorefrontLocationOptions() {
  const regions = await prisma.deliveryRegion.findMany({ where: { active: true }, select: { slug: true, name: true, city: true, province: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], take: 100 });
  return regions.map((region) => ({ reference: region.slug, name: region.name, ...(region.city ? { city: region.city } : {}), ...(region.province ? { province: region.province } : {}) }));
}

export async function resolveStorefrontLocation(input: { serviceAreaReference?: string; suburb?: string; postalCode?: string }): Promise<{ context: StorefrontLocationContext; cookieValue?: string }> {
  const requested = input.serviceAreaReference?.toLocaleLowerCase("en-ZA").trim();
  if (requested && SAFE_REFERENCE.test(requested)) {
    const region = await prisma.deliveryRegion.findFirst({ where: { slug: requested, active: true }, select: { slug: true, province: true } });
    if (region) return { context: { serviceAreaReference: region.slug, ...(region.province ? { province: region.province } : {}), resolutionStatus: "RESOLVED" }, cookieValue: encodeStorefrontLocationContext({ area: region.slug, status: "RESOLVED", issuedAt: Date.now() }) };
  }
  // Existing delivery regions are the only authority. Suburb/postal code is only
  // matched against stored coarse city/province text; no geocoder is contacted.
  const clue = (input.suburb ?? input.postalCode ?? "").normalize("NFKC").trim().slice(0, 80);
  if (clue) {
    const matches = await prisma.deliveryRegion.findMany({ where: { active: true, OR: [{ city: { equals: clue, mode: "insensitive" } }, { province: { equals: clue, mode: "insensitive" } }] }, select: { slug: true, province: true }, take: 2 });
    if (matches.length === 1) {
      const match = matches[0]!;
      return { context: { serviceAreaReference: match.slug, ...(match.province ? { province: match.province } : {}), resolutionStatus: "RESOLVED" }, cookieValue: encodeStorefrontLocationContext({ area: match.slug, status: "RESOLVED", issuedAt: Date.now() }) };
    }
    if (matches.length > 1) return { context: { serviceAreaReference: null, resolutionStatus: "AMBIGUOUS" } };
  }
  return { context: { serviceAreaReference: null, resolutionStatus: "UNSUPPORTED" }, cookieValue: encodeStorefrontLocationContext({ area: "unsupported", status: "UNSUPPORTED", issuedAt: Date.now() }) };
}

export const STOREFRONT_LOCATION_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_CONTEXT_AGE_SECONDS };
