import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";

const MAX_RETRIES = 5;

export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();

  for (let i = 0; i < MAX_RETRIES; i++) {
    const suffix = crypto.randomInt(0, 999_999).toString().padStart(6, "0");
    const orderNumber = `KT-${year}-${suffix}`;

    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });

    if (!existing) return orderNumber;
  }

  // Retain a compact reference even under extraordinary primary-number
  // collisions. Eight random base36 characters provide over 41 bits of
  // entropy; every candidate is checked before returning it.
  for (let i = 0; i < 12; i++) {
    const random = crypto.randomBytes(8).readBigUInt64BE();
    const suffix = random.toString(36).toUpperCase().padStart(8, "0").slice(-8);
    const candidate = `KT-${year}-${suffix}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  // Failing closed is preferable to issuing a duplicate tracking number.
  throw new Error("ORDER_REFERENCE_EXHAUSTED");
}
