import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const aadValue = Buffer.from("KT-COURIER-LEGACY-6AMMART-CATALOG-V1");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function keyBytes(key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? "")) throw new Error("A 32-byte hex migration key is required.");
  return Buffer.from(key, "hex");
}
export function encryptSource(bytes, key) {
  const nonce = randomBytes(12), aad = aadValue.toString("base64");
  const compressed = gzipSync(bytes);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), nonce);
  cipher.setAAD(Buffer.from(aad, "base64"));
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final(), cipher.getAuthTag()]);
  return { version: 1, algorithm: "AES-256-GCM", compression: "gzip", aad, nonce: nonce.toString("base64"), ciphertext: ciphertext.toString("base64"), plaintext_sha256: digest(bytes), compressed_sha256: digest(compressed) };
}
export function decryptSource(envelope, key) {
  if (envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM" || envelope.compression !== "gzip" || envelope.aad !== aadValue.toString("base64")) throw new Error("Unsupported source envelope.");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), Buffer.from(envelope.nonce, "base64"));
  decipher.setAAD(Buffer.from(envelope.aad, "base64"));
  decipher.setAuthTag(ciphertext.subarray(-16));
  const compressed = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
  if (digest(compressed) !== envelope.compressed_sha256) throw new Error("Compressed source fingerprint mismatch.");
  const bytes = gunzipSync(compressed, { maxOutputLength: 64 * 1024 * 1024 });
  if (digest(bytes) !== envelope.plaintext_sha256) throw new Error("Source fingerprint mismatch.");
  return bytes;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, input, output] = process.argv.slice(2);
  const key = process.env.KT_LEGACY_SOURCE_KEY;
  if (mode === "encrypt") writeFileSync(output, JSON.stringify(encryptSource(readFileSync(input), key)));
  else if (mode === "decrypt") writeFileSync(output, decryptSource(JSON.parse(readFileSync(input, "utf8")), key), { mode: 0o600 });
  else throw new Error("Usage: source-envelope.mjs encrypt|decrypt input output");
}
