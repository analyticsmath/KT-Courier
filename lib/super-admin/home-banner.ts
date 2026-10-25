import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const image = z.url().regex(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/[a-zA-Z0-9_./%,-]+$/);
const internal = z.string().regex(/^\/(?!\/)(?:[A-Za-z0-9/_-]*)(?:\?[A-Za-z0-9=&_%-]*)?$/);
export const BannerDraftSchema=z.object({
  title:z.string().trim().min(3).max(90),description:z.string().trim().min(3).max(250),
  imageUrl:image,altText:z.string().trim().min(5).max(220),href:internal,
  startsAt:z.iso.datetime(),endsAt:z.iso.datetime(),expectedVersion:z.number().int().min(0),
}).strict().refine(x=>new Date(x.startsAt)<new Date(x.endsAt)&&new Date(x.endsAt).getTime()-new Date(x.startsAt).getTime()<=180*24*60*60*1000,{message:"Banner schedule must have a positive duration of at most 180 days."});
export type BannerDraft=z.infer<typeof BannerDraftSchema>;
export type BannerApproved=Omit<BannerDraft,"expectedVersion">&{createdByUserId:string;approvedByUserId:string;createdAt:string;approvedAt:string};
export type PublicHomeBanner=Pick<BannerApproved,"title"|"description"|"imageUrl"|"altText"|"href">;
type Candidate=Omit<BannerDraft,"expectedVersion">&{createdByUserId:string;createdAt:string};
type BannerState={version:number;draft:Candidate|null;active:BannerApproved|null};
const KEY="kt_home_editorial_banner_v1";
function parseState(value:unknown):BannerState {
  if(!value||typeof value!=="object"||Array.isArray(value))return {version:0,draft:null,active:null};
  const v=value as Partial<BannerState>;
  return {version:typeof v.version==="number"?v.version:0,draft:v.draft??null,active:v.active??null};
}
export function eligibleHomeBanner(banner:BannerApproved|null,at=new Date()):BannerApproved|null {
  if(!banner||!banner.approvedByUserId||banner.approvedByUserId===banner.createdByUserId)return null;
  const { title,description,imageUrl,altText,href,startsAt,endsAt }=banner;
  const parsed=BannerDraftSchema.safeParse({title,description,imageUrl,altText,href,startsAt,endsAt,expectedVersion:0});
  if(!parsed.success||at<new Date(banner.startsAt)||at>=new Date(banner.endsAt))return null;
  return banner;
}
export async function getPublishedHomeBanner(at=new Date()){
  const row=await prisma.systemSetting.findUnique({where:{key:KEY},select:{value:true}});
  const approved=eligibleHomeBanner(parseState(row?.value).active,at);
  if(!approved)return null;
  // Do not serialize approver identity or audit timestamps into public client components.
  const {title,description,imageUrl,altText,href}=approved;
  return {title,description,imageUrl,altText,href} satisfies PublicHomeBanner;
}
export async function readHomeBannerState() {
  const row=await prisma.systemSetting.findUnique({where:{key:KEY},select:{value:true}});
  return parseState(row?.value);
}
export class HomeBannerError extends Error {constructor(readonly code:string,message:string,readonly status=422){super(message);this.name="HomeBannerError";}}
function assertCloudinaryUrl(uri:string) {
  const configured=process.env.CLOUDINARY_CLOUD_NAME||process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if(!configured)throw new HomeBannerError("BANNER_MEDIA_NOT_CONFIGURED","The KT Couriers Cloudinary media account is not configured.",409);
  if(new URL(uri).pathname.split("/")[1]!==configured)throw new HomeBannerError("BANNER_MEDIA_OWNER_MISMATCH","Banner must use an asset from KT Couriers' configured media account.");
}
export async function mutateHomeBanner(actorUserId:string,command:"DRAFT"|"APPROVE"|"DISABLE",raw:unknown) {
  const params=z.object({expectedVersion:z.number().int().min(0)}).passthrough().safeParse(raw);
  if(!params.success)throw new HomeBannerError("BANNER_INPUT_INVALID","Expected banner version is required.");
  const draft=command==="DRAFT"?BannerDraftSchema.safeParse(raw):null;
  if(command==="DRAFT"&&!draft?.success)throw new HomeBannerError("BANNER_INPUT_INVALID","Enter a valid banner title, owned image, accessible description, internal link and schedule.");
  if(draft?.success)assertCloudinaryUrl(draft.data.imageUrl);
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtext(${KEY}))`;
    const row=await tx.systemSetting.findUnique({where:{key:KEY}});
    const current=parseState(row?.value);
    if(current.version!==params.data.expectedVersion)throw new HomeBannerError("BANNER_VERSION_CONFLICT","Banner settings changed. Reload before continuing.",409);
    const state:BannerState={...current,version:current.version+1};
    if(command==="DRAFT"&&draft?.success){
      const {title,description,imageUrl,altText,href,startsAt,endsAt}=draft.data;
      state.draft={title,description,imageUrl,altText,href,startsAt,endsAt,createdByUserId:actorUserId,createdAt:new Date().toISOString()};
    }else if(command==="APPROVE"){
      if(!current.draft)throw new HomeBannerError("BANNER_DRAFT_MISSING","No banner draft is awaiting approval.",409);
      if(current.draft.createdByUserId===actorUserId)throw new HomeBannerError("BANNER_REVIEWER_REQUIRED","A different Super Admin must approve this banner.",403);
      assertCloudinaryUrl(current.draft.imageUrl);
      state.active={...current.draft,approvedByUserId:actorUserId,approvedAt:new Date().toISOString()};
      state.draft=null;
    }else if(command==="DISABLE"){
      state.active=null;
      // Disabling never reactivates an older campaign by accident.
    }else throw new HomeBannerError("BANNER_ACTION_INVALID","Unsupported banner action.");
    const setting={type:"JSON" as const,label:"Approved public homepage editorial banner",value:state as unknown as Prisma.InputJsonValue};
    await tx.systemSetting.upsert({where:{key:KEY},create:{key:KEY,...setting},update:setting});
    await tx.adminActivityLog.create({data:{actorUserId,action:"UPDATE",entityType:"HomepageBanner",entityId:KEY,message:`Super Admin banner ${command.toLowerCase()} recorded`,metadata:{version:state.version,action:command,approved:!!state.active}}});
    return state;
  });
}
