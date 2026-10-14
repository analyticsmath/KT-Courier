import { Prisma, PricingQuoteOwnerType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

/**
 * Owner-approved, customer/store-scoped ZAR tariff overrides. No amounts are
 * accepted from the customer: checkout prices are calculated exclusively from
 * active versioned configuration, scoped identity and verified routing.
 */
const money = z.string().regex(/^\\d{1,5}(?:\\.\\d{1,2})?$/);
const km = z.string().regex(/^\\d{1,4}(?:\\.\\d{1,4})?$/);
export const PersonalizedDeliveryRateCreateSchema = z.object({
  ownerType: z.enum(["CUSTOMER", "STORE"]),
  ownerId: z.string().min(8).max(128),
  serviceKey: z.enum(["CLIENT_ECONOMY", "CLIENT_STANDARD", "CLIENT_EXPRESS"]),
  parcelSize: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  baseFee: money,
  perKmRate: km,
  minimumCharge: money.nullable(),
  effectiveFrom: z.iso.datetime({ offset: true }),
  effectiveTo: z.iso.datetime({ offset: true }).nullable(),
  reason: z.string().trim().min(12).max(500),
}).strict().superRefine((x,ctx)=>{
  if (new Prisma.Decimal(x.baseFee).isZero() && new Prisma.Decimal(x.perKmRate).isZero()) ctx.addIssue({code:"custom",path:["baseFee"],message:"A positive fee or per-kilometre rate is required."});
  if (x.effectiveTo && new Date(x.effectiveTo) <= new Date(x.effectiveFrom)) ctx.addIssue({code:"custom",path:["effectiveTo"],message:"End must follow start."});
});
export const PersonalizedDeliveryRateActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum(["ACTIVATE", "DEACTIVATE"]),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(12).max(500),
}).strict();

export async function activePersonalizedDeliveryRate(
  owner: {ownerType:"CUSTOMER"|"STORE";ownerId:string}|null,
  serviceKey: string,
  parcelSize: string,
  now=new Date(),
) {
  if (!owner) return null;
  const results=await prisma.personalizedDeliveryRate.findMany({
    where: {ownerType:owner.ownerType,ownerId:owner.ownerId,serviceKey,parcelSize,status:"ACTIVE",
      effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},
    orderBy:[{versionNumber:"desc"}],take:2,
  });
  // No arbitrary winner when two financial policies incorrectly overlap.
  if (results.length > 1) throw new Error("PERSONALIZED_RATE_CONFLICT");
  return results[0]??null;
}
export function personalizedDeliveryRateSnapshot(rate:NonNullable<Awaited<ReturnType<typeof activePersonalizedDeliveryRate>>>) {
  return { id:rate.id, ownerType:rate.ownerType,ownerId:rate.ownerId,serviceKey:rate.serviceKey,
    parcelSize:rate.parcelSize,versionNumber:rate.versionNumber,baseFee:rate.baseFee.toString(),
    perKmRate:rate.perKmRate.toString(),minimumCharge:rate.minimumCharge?.toString()??null };
}
export async function createPersonalizedDeliveryRate(actorId:string,raw:unknown){
  const x=PersonalizedDeliveryRateCreateSchema.parse(raw);
  const ownerType=x.ownerType as PricingQuoteOwnerType;
  return prisma.$transaction(async tx=>{
    const scope=[x.ownerType,x.ownerId,x.serviceKey,x.parcelSize].join(":");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"personalized-delivery-rate:"+scope}))`;
    const eligible=x.ownerType==="CUSTOMER"
      ? Boolean(await tx.user.findFirst({where:{id:x.ownerId,role:"CUSTOMER",status:"ACTIVE"},select:{id:true}}))
      : Boolean(await tx.store.findFirst({where:{id:x.ownerId,status:"ACTIVE"},select:{id:true}}));
    if(!eligible) throw new Error("PERSONALIZED_RATE_OWNER_NOT_ELIGIBLE");
    const previous=await tx.personalizedDeliveryRate.findFirst({
      where:{ownerType,ownerId:x.ownerId,serviceKey:x.serviceKey,parcelSize:x.parcelSize},
      orderBy:{versionNumber:"desc"},select:{versionNumber:true},
    });
    const row=await tx.personalizedDeliveryRate.create({data:{
      ...x,ownerType,versionNumber:(previous?.versionNumber??0)+1,status:"DRAFT",
      baseFee:new Prisma.Decimal(x.baseFee),perKmRate:new Prisma.Decimal(x.perKmRate),
      minimumCharge:x.minimumCharge?new Prisma.Decimal(x.minimumCharge):null,
      effectiveFrom:new Date(x.effectiveFrom),effectiveTo:x.effectiveTo?new Date(x.effectiveTo):null,
      createdByUserId:actorId,
    }});
    await tx.adminActivityLog.create({data:{
      actorUserId:actorId,action:"CREATE",entityType:"PersonalizedDeliveryRate",entityId:row.id,
      message:"Prepared identity-scoped ZAR delivery tariff (inactive until activation).",
      metadata:{ownerType:x.ownerType,ownerId:x.ownerId,serviceKey:x.serviceKey,parcelSize:x.parcelSize,version:row.versionNumber,reason:x.reason},
    }});
    return row;
  });
}
export async function changePersonalizedDeliveryRate(actorId:string,raw:unknown){
  const x=PersonalizedDeliveryRateActionSchema.parse(raw);
  return prisma.$transaction(async tx=>{
    const row=await tx.personalizedDeliveryRate.findUnique({where:{id:x.id}});
    if(!row||row.versionNumber!==x.expectedVersion) throw new Error("PERSONALIZED_RATE_STALE");
    const scope=[row.ownerType,row.ownerId,row.serviceKey,row.parcelSize].join(":");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"personalized-delivery-rate:"+scope}))`;
    const next=x.action==="ACTIVATE"?"ACTIVE":"INACTIVE";
    if(x.action==="ACTIVATE" && row.status!=="DRAFT") throw new Error("PERSONALIZED_RATE_INVALID_STATE");
    if(x.action==="DEACTIVATE" && row.status!=="ACTIVE") throw new Error("PERSONALIZED_RATE_INVALID_STATE");
    if(x.action==="ACTIVATE"){
      const others=await tx.personalizedDeliveryRate.findMany({where:{
        id:{not:row.id},ownerType:row.ownerType,ownerId:row.ownerId,serviceKey:row.serviceKey,
        parcelSize:row.parcelSize,status:"ACTIVE",
      },select:{effectiveFrom:true,effectiveTo:true}});
      if(others.some(other=>(!other.effectiveTo||row.effectiveFrom<other.effectiveTo)&&(!row.effectiveTo||other.effectiveFrom<row.effectiveTo)))
        throw new Error("PERSONALIZED_RATE_CONFLICT");
    }
    const nextRow=await tx.personalizedDeliveryRate.update({where:{id:row.id},data:{
      status:next, ...(next==="ACTIVE"?{activatedByUserId:actorId,activatedAt:new Date()}:{}) ,
    }});
    await tx.adminActivityLog.create({data:{
      actorUserId:actorId,action:"STATUS_CHANGE",entityType:"PersonalizedDeliveryRate",entityId:row.id,
      message:x.action==="ACTIVATE"?"Activated owner-scoped delivery tariff.":"Deactivated owner-scoped delivery tariff.",
      metadata:{version:row.versionNumber,previousStatus:row.status,nextStatus:next,reason:x.reason},
    }});
    return nextRow;
  });
}
export async function listPersonalizedDeliveryRates() {
  return prisma.personalizedDeliveryRate.findMany({orderBy:[{createdAt:"desc"}],take:150});
}
