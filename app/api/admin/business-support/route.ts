import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  SupportAccessSchema,
  grantBusinessSupportAccess,
  readBusinessSupportDashboard,
} from "@/lib/client-platform/support-access.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const b = await mutation(req, `business-support:${u.id}`);
  if ("response" in b) return b.response;
  const p = SupportAccessSchema.safeParse(b.body);
  if (!p.success)
    return json(
      {
        error:
          "Select a business and provide a support reason of at least 10 characters.",
      },
      422,
    );
  try {
    return json(await grantBusinessSupportAccess(u, p.data), 201);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const p = zQuery(req);
  if (!p)
    return json({ error: "Provide the business and support session." }, 422);
  try {
    return json(await readBusinessSupportDashboard(u, p.storeId, p.grantId));
  } catch (e) {
    return failure(e);
  }
}
function zQuery(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId"),
    grantId = req.nextUrl.searchParams.get("grantId");
  return storeId &&
    grantId &&
    /^[a-z0-9]{20,40}$/.test(storeId) &&
    /^[a-z0-9]{20,40}$/.test(grantId)
    ? { storeId, grantId }
    : null;
}
