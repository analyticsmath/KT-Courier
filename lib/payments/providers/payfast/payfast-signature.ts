import { createHash } from "node:crypto";
import { PaymentError } from "../../errors";
import {
  normalizePayfastUnsignedFields,
  PAYFAST_V1_FIELD_ORDER,
  type PayfastCheckoutFields,
  type PayfastUnsignedFields,
} from "./payfast-fields";
import { payfastUrlEncode } from "./payfast-url-encoding";

function assertPassphrase(passphrase: string): void {
  if (!passphrase || passphrase !== passphrase.trim() || passphrase.length > 256 || /[\r\n\0]/.test(passphrase)) {
    throw new PaymentError("PAYFAST_CONFIGURATION_INVALID", "Payfast signature configuration is invalid.");
  }
}

function digestNormalizedFields(fields: PayfastUnsignedFields, passphrase: string): string {
  assertPassphrase(passphrase);
  try {
    const pairs: string[] = [];
    for (const name of PAYFAST_V1_FIELD_ORDER) {
      const value = fields[name];
      if (value !== undefined && value !== "") pairs.push(`${name}=${payfastUrlEncode(value)}`);
    }
    pairs.push(`passphrase=${payfastUrlEncode(passphrase)}`);
    return createHash("md5").update(pairs.join("&"), "utf8").digest("hex");
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("PAYFAST_SIGNATURE_GENERATION_FAILED", "Payfast signature generation failed.", false, { cause: error });
  }
}

export function generatePayfastSignature(unsignedFields: PayfastUnsignedFields, passphrase: string): string {
  return digestNormalizedFields(normalizePayfastUnsignedFields(unsignedFields), passphrase);
}

export function buildSignedPayfastForm(
  unsignedFields: PayfastUnsignedFields,
  passphrase: string,
): PayfastCheckoutFields {
  const normalized = normalizePayfastUnsignedFields(unsignedFields);
  const signature = digestNormalizedFields(normalized, passphrase);
  return Object.freeze({ ...normalized, signature });
}
