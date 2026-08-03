import { getCurrentUser } from "@/lib/auth/current-user";
import { getCustomerProfile, getStoreProfile } from "@/lib/services/profiles.service";
import { ok, unauthorized } from "@/lib/api/response";
import { UserRole } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  if (session.role === UserRole.CUSTOMER) {
    const profile = await getCustomerProfile(session.id);
    return ok(profile);
  }

  if (session.role === UserRole.STORE) {
    const profile = await getStoreProfile(session.id);
    return ok(profile);
  }

  // Admin, driver, and other roles: return basic user info
  return ok({
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    status: session.status,
  });
}
