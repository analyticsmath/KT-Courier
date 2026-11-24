import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assembleSignedEnvelope,
  buildTrustBundle,
  buildUnsignedPayloadV2,
  generateRoleKeypair,
  signRoleApproval,
} from "./signing.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const val = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
      flags[key] = val;
    }
  }
  return { command, flags };
}

function writeJson(outPath, payload) {
  writeFileSync(path.resolve(outPath), `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function readJson(inPath) {
  return JSON.parse(readFileSync(path.resolve(inPath), "utf8"));
}

const { command, flags } = parseArgs(process.argv.slice(2));

if (command === "init-keypair") {
  const entry = generateRoleKeypair({ role: flags.role, principal: flags.principal, keyId: flags.keyId });
  if (!flags.privateOut || !flags.publicOut) {
    throw new Error("--privateOut and --publicOut paths are required so private keys never print to stdout.");
  }
  writeJson(flags.privateOut, {
    role: entry.role,
    principal: entry.principal,
    keyId: entry.keyId,
    privateKeyPem: entry.privateKeyPem,
  });
  writeJson(flags.publicOut, {
    role: entry.role,
    principal: entry.principal,
    keyId: entry.keyId,
    publicKeyPem: entry.publicKeyPem,
    revoked: false,
  });
  console.log(JSON.stringify({ keyId: entry.keyId, role: entry.role, principal: entry.principal }));
} else if (command === "export-trust") {
  const files = String(flags.publicFiles ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const bundle = buildTrustBundle(files.map(readJson));
  if (!flags.out) throw new Error("--out path required.");
  writeJson(flags.out, bundle.trust);
  console.log(JSON.stringify({ trustSha256: bundle.trustSha256, keys: Object.keys(bundle.trust).length }));
} else if (command === "build-payload") {
  const context = readJson(flags.context);
  const payload = buildUnsignedPayloadV2({
    verifiedContext: context,
    maker: flags.maker,
    issuanceId: flags.issuanceId,
    issuedAt: flags.issuedAt,
    expiresAt: flags.expiresAt,
  });
  if (!flags.out) throw new Error("--out path required.");
  writeJson(flags.out, payload);
  console.log(JSON.stringify({ issuanceId: payload.issuanceId, commitSha: payload.commitSha }));
} else if (command === "sign-approval") {
  const payload = readJson(flags.payload);
  const priv = readJson(flags.privateKey);
  const approval = signRoleApproval({
    payload,
    role: priv.role,
    principal: priv.principal,
    keyId: priv.keyId,
    privateKeyPem: priv.privateKeyPem,
  });
  if (!flags.out) throw new Error("--out path required.");
  writeJson(flags.out, approval);
  console.log(JSON.stringify({ role: approval.role, keyId: approval.keyId }));
} else if (command === "assemble-envelope") {
  const payload = readJson(flags.payload);
  const trust = readJson(flags.trust);
  const approvals = String(flags.approvals ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(readJson);
  const envelope = assembleSignedEnvelope({ payload, approvals, trust });
  if (!flags.out) throw new Error("--out path required.");
  writeJson(flags.out, envelope);
  console.log(JSON.stringify({ assembled: true, issuanceId: envelope.payload.issuanceId }));
} else if (command === "ingest-audit") {
  const origin = String(flags.origin ?? process.env.RELEASE_AUTHORITY_ORIGIN ?? "").trim().replace(/\/$/, "");
  const adminToken = String(flags.adminToken ?? process.env.RELEASE_AUTHORITY_ADMIN_TOKEN ?? "").trim();
  const receiptPath = flags.receipt;
  if (!origin || !adminToken || !receiptPath) {
    throw new Error("--origin (or RELEASE_AUTHORITY_ORIGIN), --adminToken (or RELEASE_AUTHORITY_ADMIN_TOKEN), and --receipt are required.");
  }
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" && !["127.0.0.1", "localhost", "::1"].includes(parsedOrigin.hostname)) {
    throw new Error("Release authority origin must use HTTPS.");
  }
  const receipt = readJson(receiptPath);
  const res = await fetch(`${parsedOrigin.origin}/v1/release-authority/admin/audits`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ receipt }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Audit ingestion failed (${res.status}): ${body.error ?? body.code ?? "unknown error"}`);
  }
  console.log(JSON.stringify(body));
} else {
  console.error(
    "Usage: cli.mjs <init-keypair|export-trust|build-payload|sign-approval|assemble-envelope|ingest-audit> --flags...",
  );
  process.exitCode = 1;
}
