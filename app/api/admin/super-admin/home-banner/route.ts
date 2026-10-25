import type { NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { HomeBannerError, mutateHomeBanner } from "@/lib/super-admin/home-banner";

export async function POST(request:NextRequest){
 const auth=await requireSuperAdminApi({request});if(auth.response)return auth.response;
 const parsed=await prepareCatalogMutation(request,auth.user.id,"/api/admin/super-admin/home-banner");if("response"in parsed)return parsed.response;
 const body=parsed.body as {action?:unknown;data?:unknown}|null;
 if(!body||!(["DRAFT","APPROVE","DISABLE"].includes(String(body.action))))return catalogJson({error:"Select a supported banner action."},422);
 try { return catalogJson({banner:await mutateHomeBanner(auth.user.id,body.action as "DRAFT"|"APPROVE"|"DISABLE",body.data)}); }
 catch(error){if(error instanceof HomeBannerError)return catalogJson({error:error.message,code:error.code},error.status);return catalogJson({error:"Banner update was not recorded."},500);}
}
