import { beforeEach, describe, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({
 find:vi.fn(), transaction:vi.fn(), createToken:vi.fn(), createAudit:vi.fn(), notification:vi.fn(), emailReady:vi.fn(), enabled:vi.fn(),
}));
vi.mock("@/lib/db/prisma",()=>({prisma:{ user:{findUnique:f.find},$transaction:f.transaction }}));
vi.mock("@/lib/auth/tokens",()=>({generateToken:()=>"secret-token-do-not-display",hashToken:()=>"hashed-token",generateResetTokenExpiresAt:()=>new Date("2026-10-25T08:00:00Z")}));
vi.mock("@/lib/auth/password-reset-url",()=>({passwordResetUrl:()=>"https://example.com/reset-password?token=secret"}));
vi.mock("@/lib/auth/security-email-readiness",()=>({securityEmailUnavailableResponse:f.emailReady,shouldQueueSecurityEmail:f.enabled}));
vi.mock("@/lib/notifications/security-delivery",()=>({queueSecurityNotification:f.notification}));
import { requestManagedPasswordReset } from "@/lib/super-admin/account-recovery.service";
const user={id:"customer-1",role:"CUSTOMER",status:"ACTIVE",emailVerifiedAt:new Date(),name:"Recipient"};
beforeEach(()=>{
 vi.clearAllMocks();f.find.mockResolvedValue(user);f.enabled.mockReturnValue(true);f.emailReady.mockReturnValue(null);
 f.transaction.mockImplementation(async(cb:(tx:Record<string,unknown>)=>unknown)=>cb({ passwordResetToken:{create:f.createToken},adminActivityLog:{create:f.createAudit} }));
 f.createToken.mockResolvedValue({id:"reset-1",expiresAt:new Date("2026-10-25T08:00:00Z")});
});
describe("super admin account recovery",()=>{
 it("sends a time-limited reset link only to the verified account, with an audit entry, never the admin",async()=>{
  expect(await requestManagedPasswordReset("super-1","user@example.com")).toEqual({ accepted:true });
  expect(f.createToken.mock.calls[0][0].data).toMatchObject({userId:"customer-1",tokenHash:"hashed-token"});
  expect(f.notification).toHaveBeenCalledWith(expect.objectContaining({eventType:"PASSWORD_RESET",subjectUserId:"customer-1"}),expect.anything());
  expect(f.createAudit).toHaveBeenCalled();
  expect(JSON.stringify(f.createAudit.mock.calls)).not.toContain("secret-token");
 });
 it("does not issue resets for privileged admin accounts",async()=>{
  f.find.mockResolvedValue({...user,role:"SUPER_ADMIN"});
  expect(await requestManagedPasswordReset("super-1","admin@example.com")).toEqual({accepted:true});
  expect(f.createToken).not.toHaveBeenCalled();
 });
 it("gives the same safe response to an unknown address",async()=>{
  f.find.mockResolvedValue(null);
  expect(await requestManagedPasswordReset("super-1","unknown@example.com")).toEqual({accepted:true});
  expect(f.createToken).not.toHaveBeenCalled();
 });
 it("blocks unsafe delivery if security mail is unavailable",async()=>{
  f.emailReady.mockReturnValue({status:503});
  await expect(requestManagedPasswordReset("super-1","user@example.com")).rejects.toMatchObject({code:"RESET_EMAIL_UNAVAILABLE"});
  expect(f.createToken).not.toHaveBeenCalled();
 });
});
