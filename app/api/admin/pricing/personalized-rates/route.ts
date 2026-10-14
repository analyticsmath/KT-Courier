import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ok, created, conflict, unprocessable, serverError } from "@/lib/api/response";
import { createPersonalizedDeliveryRate, changePersonalizedDeliveryRate, listPersonalizedDeliveryRates } from "@/lib/pricing/personalized-delivery-rates";

function errorResponse(error:unknown){
  if(error instanceof ZodError)return unprocessable("Invalid personalized delivery rate.",Object.fromEntries(error.issues.map(i=>[i.path.join(".")||"input",i.message])));
  if(error instanceof Error){
    if(["PERSONALIZED_RATE_STALE","PERSONALIZED_RATE_INVALID_STATE","PERSONALIZED_RATE_CONFLICT"].includes(error.message))return conflict("Rate was changed or another active version overlaps this period.");
    if(error.message==="PERSONALIZED_RATE_OWNER_NOT_ELIGIBLE")return unprocessable("Select an existing active customer or store.");
  }
  return serverError();
}
export async function GET(){
  const auth=await requireAdminApiPermission(PERMISSIONS.PRICING_READ);
  if(auth.response)return auth.response;
  try {return ok((await listPersonalizedDeliveryRates()).map(rate=>({
    ...rate,baseFee:rate.baseFee.toFixed(2),perKmRate:rate.perKmRate.toFixed(4),
    minimumCharge:rate.minimumCharge?.toFixed(2)??null,
  })));}catch{return serverError();}
}
export async function POST(req:NextRequest){
  const origin=await enforceSameOriginRequest(req);if(origin)return origin;
  const auth=await requireAdminApiPermission(PERMISSIONS.PRICING_MANAGE,{request:req});if(auth.response)return auth.response;
  let payload:unknown;try{payload=await req.json()}catch{return unprocessable("Expected a JSON request.")}
  try{const row=await createPersonalizedDeliveryRate(auth.user.id,payload);return created({id:row.id,status:row.status,versionNumber:row.versionNumber});}
  catch(e){return errorResponse(e);}
}
export async function PATCH(req:NextRequest){
  const origin=await enforceSameOriginRequest(req);if(origin)return origin;
  const auth=await requireAdminApiPermission(PERMISSIONS.PRICING_MANAGE,{request:req});if(auth.response)return auth.response;
  let payload:unknown;try{payload=await req.json()}catch{return unprocessable("Expected a JSON request.")}
  try{const row=await changePersonalizedDeliveryRate(auth.user.id,payload);return ok({id:row.id,status:row.status,versionNumber:row.versionNumber});}
  catch(e){return errorResponse(e);}
}
