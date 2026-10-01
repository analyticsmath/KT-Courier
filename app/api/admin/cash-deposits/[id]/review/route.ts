import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import {
  DepositReviewSchema,
  reviewDriverDeposit,
} from "@/lib/client-platform/driver-cash.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const a = await requireAdminApiPermission("cod_operations.manage");
  if (a.response) return a.response;
  const b = await mutation(req, `deposit-review:${a.user.id}`);
  if ("response" in b) return b.response;
  const p = DepositReviewSchema.safeParse(b.body);
  if (!p.success)
    return json(
      { error: "Confirm actual bank receipt and provide a review note." },
      422,
    );
  try {
    return json(await reviewDriverDeposit(a.user, (await c.params).id, p.data));
  } catch (e) {
    return failure(e);
  }
}
