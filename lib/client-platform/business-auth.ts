import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { storeAccess } from "./store-access";
import { membershipAllows, moduleForStorePath } from "./store-permissions";
import { json, failure } from "./api";
import { PlatformError } from "./contracts";
export async function requireBusinessApi(path: string) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentication required." }, 401);
  if (user.status !== "ACTIVE" || !["CUSTOMER", "STORE"].includes(user.role))
    return json({ error: "An active business account is required." }, 403);
  try {
    const a = await storeAccess(user.id);
    if (!a.owner && !membershipAllows(a.permissions, moduleForStorePath(path)))
      throw new PlatformError(
        "STORE_ACCESS_DENIED",
        "Business section access denied.",
        403,
      );
    return null;
  } catch (e) {
    return failure(e);
  }
}
export async function requireBusinessPage(path: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let access;
  try {
    access = await storeAccess(user.id);
  } catch {
    redirect("/account");
  }
  if (
    !access.owner &&
    path !== "/store/workspace" &&
    !membershipAllows(access.permissions, moduleForStorePath(path))
  )
    redirect("/store/workspace");
  return { user, ...access };
}
