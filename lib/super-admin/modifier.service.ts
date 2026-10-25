import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ModifierGroupCreateSchema } from "@/lib/validation/catalog";
import { createStoreModifierGroup, attachModifierGroup } from "@/lib/services/catalog-modifier.service";
import { ManagedCommerceError } from "@/lib/super-admin/commerce.service";

const schema=ModifierGroupCreateSchema.extend({storeId:z.string().min(15).max(64),offerId:z.string().min(15).max(64)}).strict();
export async function createManagedModifierGroup(actorId:string,input:unknown){
 const parsed=schema.safeParse(input);
 if(!parsed.success)throw new ManagedCommerceError("MODIFIER_INPUT_INVALID",parsed.error.issues[0]?.message??"Invalid modifier options.");
 const {storeId,offerId,...data}=parsed.data;
 const store=await prisma.store.findFirst({where:{id:storeId,status:{in:["ACTIVE","PENDING"]}},select:{id:true}});
 if(!store)throw new ManagedCommerceError("STORE_NOT_EDITABLE","Store is not editable.",409);
 const offer=await prisma.storeCatalogOffer.findFirst({where:{id:offerId,storeId},select:{id:true,status:true}});
 if(!offer)throw new ManagedCommerceError("OFFER_NOT_FOUND","Store offer not found.",404);
 if(offer.status!=="DRAFT")throw new ManagedCommerceError("ACTIVE_PRICE_CHANGE_DENIED","Add-ons may only be attached to draft offers. Existing live prices cannot change without the reviewed offer process.",409);
 return prisma.$transaction(async tx=>{
  const group=await createStoreModifierGroup(storeId,actorId,data,tx);
  await attachModifierGroup(storeId,offerId,group.id,0,tx);
  return group;
 });
}
