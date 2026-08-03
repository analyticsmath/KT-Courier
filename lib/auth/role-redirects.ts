import { UserRole } from "@/types/db";

const POST_AUTH_REDIRECTS: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: "/account",
  [UserRole.STORE]: "/store",
  [UserRole.DRIVER]: "/driver",
  [UserRole.ADMIN]: "/admin",
  [UserRole.SUPER_ADMIN]: "/admin",
  [UserRole.PROMOTER]: "/promoter",
};

export function getPostAuthRedirect(role: UserRole): string {
  return POST_AUTH_REDIRECTS[role] ?? "/";
}
