import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { z } from "zod";
import {
  MessageSchema,
  conversationMessages,
  sendConversationMessage,
} from "@/lib/client-platform/conversations.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
const query = z
  .object({
    scope: z.enum(["personal", "STORE", "admin"]).default("personal"),
    before: z.string().cuid().optional(),
    after: z.string().cuid().optional(),
  })
  .strict();
export async function GET(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const p = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return json({ error: "Invalid conversation query." }, 422);
  try {
    return json(
      await conversationMessages(
        u,
        (await c.params).id,
        p.data.scope,
        p.data.before,
        p.data.after,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const q = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return json({ error: "Invalid conversation scope." }, 422);
  const b = await mutation(req, `message:${u.id}`);
  if ("response" in b) return b.response;
  const p = MessageSchema.safeParse(b.body);
  if (!p.success)
    return json({ error: "Messages must contain 1–4000 characters." }, 422);
  try {
    return json(
      await sendConversationMessage(
        u,
        (await c.params).id,
        q.data.scope,
        p.data,
      ),
      201,
    );
  } catch (e) {
    return failure(e);
  }
}
