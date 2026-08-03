import { createHash } from "node:crypto";
import type { PaymentProviderEnvironment } from "@/lib/payments/types";

const DELIMITER = Buffer.from([0]);

export function fingerprintPayfastWebhook(
  environment: PaymentProviderEnvironment,
  exactBody: Uint8Array,
): string {
  return createHash("sha256")
    .update(Buffer.from("PAYFAST", "ascii"))
    .update(DELIMITER)
    .update(Buffer.from(environment, "ascii"))
    .update(DELIMITER)
    .update(exactBody)
    .digest("hex");
}
