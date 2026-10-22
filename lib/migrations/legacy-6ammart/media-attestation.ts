import { createHmac, timingSafeEqual } from "node:crypto";

/** Bind a full-decode receipt to the exact manifest and the protected migration key. */
export function attestDecodedManifest(manifest: string, key: string): string {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("A protected 32-byte migration key is required.");
  return createHmac("sha256", Buffer.from(key, "hex")).update("KT-LEGACY-FULL-DECODE-V1\0").update(manifest).digest("hex");
}

export function decodedManifestAttested(manifest: string, key: string | undefined, receipt: string | undefined): boolean {
  if (!key || !/^[a-f0-9]{64}$/i.test(key) || !receipt || !/^[a-f0-9]{64}$/i.test(receipt)) return false;
  return timingSafeEqual(Buffer.from(attestDecodedManifest(manifest, key), "hex"), Buffer.from(receipt, "hex"));
}
