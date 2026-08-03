import { redirect } from "next/navigation";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { normalizePromoterCode } from "@/lib/promoters/code-security";
import { resolvePromoterProductionComposition } from "@/lib/promoters/composition-root";

/** Public referral landing intentionally accepts only an opaque code and always stays on an internal registration route. */
export default async function ReferralLanding({ params }: { params: Promise<{ opaqueCode: string }> }) {
  const { opaqueCode } = await params;
  let destination = "/signup";
  try {
    const normalized = normalizePromoterCode(opaqueCode);
    const root = resolvePromoterProductionComposition();
    if (root.status !== "LOCKED") {
      const requestHeaders = await headers();
      const resolved = await root.services.lifecycle.resolvePromoterReferralCode({ code: normalized });
      const touch = await root.services.lifecycle.recordPromoterTouch({
        operationId: `touch:${randomUUID()}`,
        programVersionId: resolved.programVersionId,
        code: normalized,
        touchType: "LINK_VISIT",
        destinationType: "CUSTOMER_REGISTRATION",
        sessionFingerprint: createHash("sha256").update(requestHeaders.get("user-agent") ?? "").digest("hex"),
        networkRiskFingerprint: createHash("sha256").update(requestHeaders.get("x-forwarded-for") ?? "").digest("hex"),
      });
      const token = await root.services.lifecycle.createSignedReferralToken({ touchReference: touch.publicReference, programVersionReference: resolved.programVersionReference, enrollmentReference: resolved.enrollmentReference, destinationType: "CUSTOMER_REGISTRATION", ttlSeconds: 900 });
      destination = `/signup?promoter_token=${encodeURIComponent(token)}`;
    }
  } catch { redirect("/signup"); }
  redirect(destination);
}
