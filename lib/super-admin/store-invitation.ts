import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { ManagedCommerceError } from "@/lib/super-admin/commerce.service";

const safeName=z.string().trim().min(2).max(140).refine(s=>!/<\/?[a-z][^>]*>/i.test(s));
export const InvitationDraftSchema=z.object({
 email:z.email().trim().toLowerCase().max(254),storeName:safeName,contactName:safeName,
}).strict();
export type InvitationClaim={email:string;storeName:string};
export function verifyStoreInvitationClaim(invitation:{email:string;storeName:string;status:string;expiresAt:Date}|null,claim:InvitationClaim,now=new Date()) {
 if(!invitation||invitation.status!=="PENDING"||now>=invitation.expiresAt||invitation.email.toLowerCase()!==claim.email.toLowerCase()||invitation.storeName!==claim.storeName)
  throw new ManagedCommerceError("STORE_INVITATION_INVALID","The store invitation is invalid, expired or already used.",409);
}
export async function createManagedStoreInvitation(actorUserId:string,raw:unknown){
 const valid=InvitationDraftSchema.safeParse(raw);
 if(!valid.success)throw new ManagedCommerceError("INVITATION_INPUT_INVALID","Enter a valid vendor email, business name and contact person.");
 const input=valid.data;
 const exists=await prisma.user.findUnique({where:{email:input.email},select:{id:true}});
 if(exists)throw new ManagedCommerceError("INVITATION_ACCOUNT_EXISTS","This email is already registered. Use the existing vendor-management or store-creation process.",409);
 const token=generateToken(32);
 const expiresAt=new Date(Date.now()+72*60*60*1000);
 const record=await prisma.$transaction(async tx=>{
  const result=await tx.storeOnboardingInvitation.create({data:{...input,tokenHash:hashToken(token),expiresAt,createdByUserId:actorUserId}});
  await tx.adminActivityLog.create({data:{actorUserId,action:"CREATE",entityType:"StoreOnboardingInvitation",entityId:result.id,message:"Prepared self-service vendor onboarding invitation. Account must register and verify before store approval.",metadata:{expiresAt:expiresAt.toISOString()}}});
  return result;
 });
 // The raw token is intentionally returned only once to the authenticated Super Admin.
 return { invitationId:record.id,signupUrl:`/signup?role=store&invite=${encodeURIComponent(token)}&email=${encodeURIComponent(input.email)}&storeName=${encodeURIComponent(input.storeName)}`,expiresAt:expiresAt.toISOString() };
}
