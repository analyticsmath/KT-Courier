import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptEmployeeInvitation } from "@/lib/client-platform/employees.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return json({ error: "Sign in with the invited email address." }, 401);
  const b = await mutation(req, `invitation:${user.id}`);
  if ("response" in b) return b.response;
  const p = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .safeParse(b.body);
  if (!p.success) return json({ error: "This invitation is invalid." }, 422);
  try {
    return json(await acceptEmployeeInvitation(user.id, p.data.token));
  } catch (e) {
    return failure(e);
  }
}
