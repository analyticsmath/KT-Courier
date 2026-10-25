import { type NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { prepareCatalogMutation, catalogJson } from "@/lib/catalog/catalog-api-policy";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { requestManagedPasswordReset, ManagedResetError } from "@/lib/super-admin/account-recovery.service";

export async function POST(request:NextRequest){
  const auth=await requireSuperAdminApi({request});if(auth.response)return auth.response;
  const parsed=await prepareCatalogMutation(request,auth.user.id,"/api/admin/super-admin/password-reset");if("response"in parsed)return parsed.response;
  const body=parsed.body;
  if(!body||typeof body!=="object"||Array.isArray(body)||!("email"in body))return catalogJson({error:"Provide an email address."},422);
  const email = (body as {email:unknown}).email;
  const limit = await checkAuthRateLimit(request,"super-admin-password-reset",`${auth.user.id}:${String(email).trim().toLowerCase()}`,RATE_LIMITS.FORGOT_PASSWORD);
  if(!limit.ok)return catalogJson({error:"Password recovery was requested too frequently. Try again later."},429);
  try {
    return catalogJson(await requestManagedPasswordReset(auth.user.id,(body as {email:unknown}).email));
  } catch(error){
    if(error instanceof ManagedResetError)return catalogJson({error:error.message,code:error.code},error.status);
    return catalogJson({error:"Could not queue password recovery. No password was changed."},503);
  }
}
