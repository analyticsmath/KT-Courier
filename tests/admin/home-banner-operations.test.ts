import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
const d=vi.hoisted(()=>({find:vi.fn(),upsert:vi.fn(),audit:vi.fn(),lock:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{systemSetting:{findUnique:d.find},$transaction:async(cb:(tx:unknown)=>Promise<unknown>)=>cb({systemSetting:{findUnique:d.find,upsert:d.upsert},adminActivityLog:{create:d.audit},$queryRaw:d.lock})}}));
import {getPublishedHomeBanner,mutateHomeBanner} from "@/lib/super-admin/home-banner";
const data={title:"Special delivery",description:"Send parcels with KT Couriers",imageUrl:"https://res.cloudinary.com/kt-couriers/image/upload/v1/banner.webp",altText:"Courier carrying a parcel at the door",href:"/quote",startsAt:"2026-10-25T00:00:00Z",endsAt:"2026-11-25T00:00:00Z",expectedVersion:0};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("CLOUDINARY_CLOUD_NAME","kt-couriers");d.find.mockResolvedValue(null);});afterEach(()=>vi.unstubAllEnvs());
describe("independently governed public banner",()=>{
 it("stores an unpublished draft with audit data, never a live banner",async()=>{
  const state=await mutateHomeBanner("author","DRAFT",data);
  expect(state).toMatchObject({version:1,active:null,draft:{title:"Special delivery",createdByUserId:"author"}});
  expect(d.upsert).toHaveBeenCalledTimes(1);
 });
 it("rejects self approval and stale version before changing public state",async()=>{
  d.find.mockResolvedValue({value:{version:1,draft:{...data,createdByUserId:"author",createdAt:"2026-10-25T00:00:00Z"},active:null}});
  await expect(mutateHomeBanner("author","APPROVE",{expectedVersion:1})).rejects.toMatchObject({code:"BANNER_REVIEWER_REQUIRED"});
  await expect(mutateHomeBanner("reviewer","APPROVE",{expectedVersion:0})).rejects.toMatchObject({code:"BANNER_VERSION_CONFLICT"});
  expect(d.upsert).not.toHaveBeenCalled();
 });
 it("publishes only with independent review, and public response omits admin IDs",async()=>{
  d.find.mockResolvedValue({value:{version:1,draft:{...data,createdByUserId:"author",createdAt:"2026-10-25T00:00:00Z"},active:null}});
  const state=await mutateHomeBanner("reviewer","APPROVE",{expectedVersion:1});
  expect(state.active).toMatchObject({approvedByUserId:"reviewer",title:data.title});
  d.find.mockResolvedValue({value:{...state}});
  const publicResult=await getPublishedHomeBanner(new Date("2026-11-01T00:00:00Z"));
  expect(publicResult).toMatchObject({title:data.title,href:"/quote"});
  expect(JSON.stringify(publicResult)).not.toContain("reviewer");
  expect(JSON.stringify(publicResult)).not.toContain("createdByUserId");
 });
 it("emergency disable erases the active payload and creates an audit event",async()=>{
  d.find.mockResolvedValue({value:{version:1,draft:null,active:{...data,createdByUserId:"author",approvedByUserId:"reviewer"}}});
  expect(await mutateHomeBanner("admin","DISABLE",{expectedVersion:1})).toMatchObject({active:null,version:2});
  expect(d.audit).toHaveBeenCalledTimes(1);
 });
});
