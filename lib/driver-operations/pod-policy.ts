import { ProofOfDeliveryMethod } from "@/types/db";

export function requiresEvidenceReference(method: ProofOfDeliveryMethod): boolean {
  return method === ProofOfDeliveryMethod.PHOTO_FUTURE || method === ProofOfDeliveryMethod.SIGNATURE_FUTURE;
}
