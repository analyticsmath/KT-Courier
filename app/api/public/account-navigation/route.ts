import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Navigation is rendered for anonymous visitors, so absence of a session is
 * a valid 200 response, NOT an authentication failure. Keep /api/auth/me
 * strict (401) for protected account consumers.
 *
 * Never accept a claimed role from query params or browser local storage:
 * resolve the same server-validated session used by the account dashboard.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { role: user?.role ?? null },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    },
  );
}
