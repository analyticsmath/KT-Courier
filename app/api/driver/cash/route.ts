import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  DepositSchema,
  driverCashSummary,
  submitDriverDeposit,
} from "@/lib/client-platform/driver-cash.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  try {
    return json(await driverCashSummary(u.id));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const b = await mutation(req, `deposit:${u.id}`);
  if ("response" in b) return b.response;
  const p = DepositSchema.safeParse(b.body);
  if (!p.success)
    return json(
      {
        error:
          "Provide the delivery, exact deposited amount and bank reference.",
      },
      422,
    );
  try {
    return json(await submitDriverDeposit(u.id, p.data), 201);
  } catch (e) {
    return failure(e);
  }
}
