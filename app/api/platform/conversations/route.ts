import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ConversationSchema,
  listConversations,
  openConversation,
  type ConversationScope,
} from "@/lib/client-platform/conversations.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const scope = req.nextUrl.searchParams.get("scope") ?? "personal";
  if (!["personal", "STORE", "admin"].includes(scope))
    return json({ error: "Invalid conversation scope." }, 422);
  try {
    return json({
      conversations: await listConversations(u, scope as ConversationScope),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const b = await mutation(req, `conversation:${u.id}`);
  if ("response" in b) return b.response;
  const p = ConversationSchema.safeParse(b.body);
  if (!p.success)
    return json(
      { error: "Provide a valid subject and delivery when applicable." },
      422,
    );
  try {
    return json(await openConversation(u, p.data), 201);
  } catch (e) {
    return failure(e);
  }
}
