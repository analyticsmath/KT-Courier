import {describe,it,expect} from "vitest";
import { BannerDraftSchema, eligibleHomeBanner } from "@/lib/super-admin/home-banner";
const base={title:"Send something special",description:"Courier services for your neighbourhood",imageUrl:"https://res.cloudinary.com/kt-couriers/image/upload/v1/banner.jpg",altText:"A parcel ready for collection",href:"/quote",startsAt:"2026-11-01T09:00:00.000Z",endsAt:"2026-11-30T09:00:00.000Z",expectedVersion:0};
describe("controlled KT homepage banner",()=>{
 it("accepts a scheduled image and internal target",()=>{
  expect(BannerDraftSchema.safeParse(base).success).toBe(true);
 });
 it("rejects javascript destinations, arbitrary asset domains, missing alt text and invalid schedule",()=>{
  for(const b of [{...base,href:"javascript:alert(1)"},{...base,imageUrl:"https://example.com/banner.jpg"},{...base,altText:""},{...base,endsAt:base.startsAt}])
   expect(BannerDraftSchema.safeParse(b).success).toBe(false);
 });
 it("renders only approved banners during their approved window",()=>{
  const approved={...base,approvedByUserId:"reviewer",createdByUserId:"author",approvedAt:"2026-10-25T07:00:00.000Z",createdAt:"2026-10-25T06:00:00.000Z"};
  expect(eligibleHomeBanner(approved,new Date("2026-11-05T00:00:00Z"))).toMatchObject({title:base.title});
  expect(eligibleHomeBanner(approved,new Date("2026-10-31T00:00:00Z"))).toBe(null);
  expect(eligibleHomeBanner(approved,new Date("2026-12-01T00:00:00Z"))).toBe(null);
  expect(eligibleHomeBanner({...approved,approvedByUserId:"author"},new Date("2026-11-05T00:00:00Z"))).toBe(null);
 });
});
