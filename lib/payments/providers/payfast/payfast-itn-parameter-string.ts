import { PaymentError } from "@/lib/payments/errors";
import type { OrderedPayfastItnField } from "./payfast-itn-parser";
import { payfastUrlEncode } from "./payfast-url-encoding";

export type PayfastItnParameterStringOptions = Readonly<{
  includePassphrase: boolean;
  passphrase?: string;
}>;

function invalidStructure(message: string): never {
  throw new PaymentError("PAYFAST_ITN_FORM_INVALID", message);
}

function validPassphrase(passphrase: string): boolean {
  return passphrase.length > 0 && passphrase.length <= 256 && passphrase === passphrase.trim() && !/[\r\n\0]/.test(passphrase);
}

/**
 * Reconstructs the Payfast protocol parameter string from the immutable,
 * received-order field model. It deliberately does not use raw form bytes:
 * incoming encodings normalize through the parser and this PHP-compatible
 * encoder before either signature verification or query validation.
 */
export function buildPayfastItnParameterString(
  orderedFields: readonly OrderedPayfastItnField[],
  options: PayfastItnParameterStringOptions,
): string {
  const pairs: string[] = [];
  let signatureSeen = false;

  for (const field of orderedFields) {
    if (field.key === "signature") {
      if (signatureSeen || field.value.length === 0) invalidStructure("The Payfast ITN signature field is invalid.");
      signatureSeen = true;
      continue;
    }
    if (signatureSeen && field.value.length > 0) {
      invalidStructure("Payfast ITN fields after signature are not supported.");
    }
    if (!signatureSeen && field.value.length > 0) {
      pairs.push(`${field.key}=${payfastUrlEncode(field.value)}`);
    }
  }

  if (!signatureSeen) invalidStructure("The Payfast ITN signature field is required.");
  if (options.includePassphrase) {
    if (typeof options.passphrase !== "string" || !validPassphrase(options.passphrase)) {
      throw new PaymentError("PAYFAST_CONFIGURATION_INVALID", "Payfast ITN credential configuration is invalid.");
    }
    pairs.push(`passphrase=${payfastUrlEncode(options.passphrase)}`);
  }
  return pairs.join("&");
}
