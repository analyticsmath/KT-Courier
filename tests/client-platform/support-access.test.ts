import { beforeEach,describe,it,expect,vi } from "vitest";
import type { AuthenticatedUser } from "@/types/domain";
const db=vi.hoisted(()=>({store:{findUnique:vi.fn()},businessSupportAccess:{create:vi.fn(),findFirst:vi.fn(),findMany:vi.fn()},adminActivityLog:{create:vi.fn()},order:{groupBy:vi.fn()},storeEmployeeMembership:{groupBy:vi.fn()},deliveryReview:{aggregate:vi.fn()},managedMarketingRequest:{groupBy:vi.fn()},subscriptionContract:{findMany:vi.fn()},$transaction:vi.fn()}));
const permission=vi.hoisted(()=>vi.fn());const access=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/db/prisma",()=>({prisma:db}));vi.mock("@/lib/auth/permissions",()=>({hasPermission:permission}));vi.mock("@/lib/client-platform/store-access",()=>({storeAccess:access}));
import { grantBusinessSupportAccess,readBusinessSupportDashboard,listBusinessSupportHistory,SupportAccessSchema } from "@/lib/client-platform/support-access.service";
const u={id:"super",role:"SUPER_ADMIN",status:"ACTIVE",email:"super@example.test"} as AuthenticatedUser;const input={storeId:"corder12345678901234567890",reason:"Investigating delivery issue"};
beforeEach(()=>{vi.resetAllMocks();db.$transaction.mockImplementation((fn:(tx:typeof db)=>unknown)=>fn(db));permission.mockResolvedValue(true);db.store.findUnique.mockResolvedValue({id:input.storeId,name:"Business"});db.businessSupportAccess.create.mockResolvedValue({id:"grant",createdAt:new Date()});});
describe("audited business support",()=>{
 it("never gives ordinary admins oversight access",async()=>{await expect(grantBusinessSupportAccess({...u,role:"ADMIN"},input)).rejects.toMatchObject({status:403});expect(db.businessSupportAccess.create).not.toHaveBeenCalled();});
 it("records the real super-admin and access reason",async()=>{await grantBusinessSupportAccess(u,input);expect(db.businessSupportAccess.create.mock.calls[0][0].data).toEqual({...input,actorUserId:"super"});expect(db.adminActivityLog.create.mock.calls[0][0].data.actorUserId).toBe("super");});
 it("requires a meaningful access reason",()=>{expect(SupportAccessSchema.safeParse({...input,reason:"look"}).success).toBe(false);});
 it("scopes the grant to the same actor, store and expiry before reading data",async()=>{db.businessSupportAccess.findFirst.mockResolvedValue(null);await expect(readBusinessSupportDashboard(u,input.storeId,"foreign")).rejects.toMatchObject({code:"SUPPORT_ACCESS_EXPIRED"});expect(db.businessSupportAccess.findFirst.mock.calls[0][0].where).toMatchObject({id:"foreign",storeId:input.storeId,actorUserId:"super"});expect(db.order.groupBy).not.toHaveBeenCalled();});
 it("scopes visible access history to the authorized business",async()=>{access.mockResolvedValue({store:{id:input.storeId}});db.businessSupportAccess.findMany.mockResolvedValue([]);await listBusinessSupportHistory("owner");expect(access).toHaveBeenCalledWith("owner","settings");expect(db.businessSupportAccess.findMany.mock.calls[0][0].where.storeId).toBe(input.storeId);});
});
