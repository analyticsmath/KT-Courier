/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyMarketingUnsubscribe } from "@/lib/notifications/contracts";

export async function POST(_request: Request, context: RouteContext<"/api/notifications/unsubscribe/[token]">) {
  const secret = process.env.NOTIFICATION_UNSUBSCRIBE_SIGNING_KEY;
  if (!secret) return NextResponse.json({ error: "Unsubscribe service is not configured." }, { status: 503 });
  try {
    const { token } = await context.params;
    const { subjectId, channel } = verifyMarketingUnsubscribe(token, secret);
    await (prisma as any).notificationConsentRecord.updateMany({ where: { userId: subjectId, channel, purpose: "MARKETING", status: "GRANTED" }, data: { status: "REVOKED", revokedAt: new Date(), source: "ONE_CLICK_UNSUBSCRIBE" } });
    const fingerprint = `unsubscribe_${token.slice(0, 32)}`;
    await (prisma as any).notificationSuppression.upsert({ where: { publicReference: fingerprint }, update: {}, create: { publicReference: fingerprint, userId: subjectId, channel, purpose: "MARKETING", reason: "MARKETING_CONSENT_REVOKED", evidence: { mechanism: "ONE_CLICK_UNSUBSCRIBE" } } });
    return NextResponse.json({ status: "UNSUBSCRIBED" });
  } catch {
    return NextResponse.json({ error: "Invalid unsubscribe link." }, { status: 400 });
  }
}
