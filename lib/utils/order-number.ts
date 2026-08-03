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

  // Collision-safe fallback: timestamp base36 + 4-char hex
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `KT-${year}-${ts}${rand}`;
}
