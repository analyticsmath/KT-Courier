import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptSource, decryptSource } from "../../scripts/legacy-6ammart/source-envelope.mjs";

describe("legacy catalogue encrypted source", () => {
  const key = randomBytes(32).toString("hex");
  const source = Buffer.from('{"packageVersion":1,"tables":{"stores":[]}}');
  it("recovers exact source bytes with the correct key", () => {
    expect(decryptSource(encryptSource(source, key), key)).toEqual(source);
  });
  it("rejects altered ciphertext and an incorrect key", () => {
    const envelope = encryptSource(source, key);
    const bytes = Buffer.from(envelope.ciphertext, "base64"); bytes[0] ^= 1;
    expect(() => decryptSource({ ...envelope, ciphertext: bytes.toString("base64") }, key)).toThrow();
    expect(() => decryptSource(envelope, randomBytes(32).toString("hex"))).toThrow();
  });
  it("checks source fingerprints independently of authenticated encryption", () => {
    const envelope = encryptSource(source, key);
    expect(() => decryptSource({ ...envelope, plaintext_sha256: "0".repeat(64) }, key)).toThrow(/Source fingerprint/);
    expect(() => decryptSource({ ...envelope, compressed_sha256: "0".repeat(64) }, key)).toThrow(/Compressed source/);
  });
});
