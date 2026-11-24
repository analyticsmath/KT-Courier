import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const VALID_ROLES = new Set(["operator", "finance", "database", "security"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;

export function parseHostLiteral(hostname) {
  const host = String(hostname ?? "").replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return "loopback";
  return isIP(host) ? "ip" : "domain";
}

export function netmaskMatchesPrivateOrLoopback(hostname) {
  const host = String(hostname ?? "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (ipVersion === 6) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("::ffff:")) {
      return netmaskMatchesPrivateOrLoopback(host.slice(7));
    }
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("ff")) return true;
    return false;
  }
  return false;
}

export async function resolveAndVerifyPublicAuthorityHost(hostname, options = {}) {
  const hostKind = parseHostLiteral(hostname);
  if (options.allowLoopbackForTest === true && hostKind === "loopback") {
    return { ok: true };
  }
  if (netmaskMatchesPrivateOrLoopback(hostname)) {
    return {
      ok: false,
      reason: "AUTHORITY_ENDPOINT_INVALID",
      detail: "Private, metadata, and loopback authority addresses are prohibited.",
    };
  }
  if (hostKind === "ip") {
    return { ok: true };
  }

  const resolveDns = options.resolveDns ?? lookup;
  let records;
  try {
    const raw = await resolveDns(String(hostname).replace(/^\[|\]$/g, ""), { all: true });
    records = Array.isArray(raw) ? raw : [raw];
  } catch {
    return {
      ok: false,
      reason: "AUTHORITY_UNREACHABLE",
      detail: "Unable to resolve independent authority hostname.",
    };
  }

  if (records.length === 0 || records.some((entry) => !entry?.address || netmaskMatchesPrivateOrLoopback(entry.address))) {
    return {
      ok: false,
      reason: "AUTHORITY_ENDPOINT_INVALID",
      detail: "Authority hostname resolved to a private, metadata, or loopback IP address.",
    };
  }

  return { ok: true };
}

export function validateTrustBundle(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, detail: "Trust bundle must be a non-array JSON object keyed by keyId." };
  }
  const entries = Object.entries(raw);
  if (entries.length < 4) {
    return { ok: false, detail: "Trust bundle must define at least four role-separated keys." };
  }
  const normalized = {};
  for (const [keyId, entry] of entries) {
    if (!keyId || !ID_PATTERN.test(keyId) || typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { ok: false, detail: `Malformed trust entry for ${keyId}.` };
    }
    if (!Array.isArray(entry.roles) || entry.roles.length === 0 || !entry.roles.every((role) => VALID_ROLES.has(role))) {
      return { ok: false, detail: `Invalid roles in trust entry for ${keyId}.` };
    }
    if (typeof entry.principal !== "string" || !ID_PATTERN.test(entry.principal)) {
      return { ok: false, detail: `Invalid principal identity in trust entry for ${keyId}.` };
    }
    if (typeof entry.publicKey !== "string" || !entry.publicKey.includes("BEGIN PUBLIC KEY")) {
      return { ok: false, detail: `Missing PEM publicKey in trust entry for ${keyId}.` };
    }
    normalized[keyId] = {
      roles: [...entry.roles],
      principal: entry.principal,
      publicKey: entry.publicKey,
      revoked: entry.revoked === true,
    };
  }
  return { ok: true, trust: normalized };
}
