import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import {
  BankInstructionsSchema,
  readBankInstructions,
  saveBankInstructions,
} from "@/lib/client-platform/driver-cash.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function GET() {
  const a = await requireAdminApiPermission("cod_operations.manage");
  if (a.response) return a.response;
  return json({ instructions: await readBankInstructions() });
}
export async function POST(req: NextRequest) {
  const a = await requireAdminApiPermission("cod_operations.manage");
  if (a.response) return a.response;
  const b = await mutation(req, `bank-instructions:${a.user.id}`);
  if ("response" in b) return b.response;
  const p = BankInstructionsSchema.safeParse(b.body);
  if (!p.success)
    return json({ error: "Bank details are incomplete or invalid." }, 422);
  try {
    return json(await saveBankInstructions(a.user, p.data));
  } catch (e) {
    return failure(e);
  }
}
