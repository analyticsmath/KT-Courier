import { describe, expect, it, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  stage: vi.fn(), hash: vi.fn((s:string)=> "hash-"+s), findFirst:vi.fn(), updateMany:vi.fn(),
}));
vi.mock("@/lib/driver-operations/otp-stage-authority", () => ({ isIssuedOtpForStage: mock.stage }));
vi.mock("@/lib/auth/otp", () => ({ hashOtp: mock.hash, generateOtpCode: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { deliveryOtp: { findFirst: mock.findFirst } } }));
import { verifyDeliveryOtpInTx, getDeliveryOtpStatus } from "@/lib/services/delivery-otp.service";
describe("stage specific OTP consumption", () => {
  const active = () => ({id:"otp-one", assignmentId:"assignment-one", codeHash:"hash-123456", lockedAt:null, attempts:0, maxAttempts:5, sentToEmail:"sender@example.test", expiresAt:new Date(Date.now()+60000)});
  beforeEach(()=>{vi.resetAllMocks();mock.findFirst.mockResolvedValue(active());mock.updateMany.mockResolvedValue({count:1});});
  it("cannot consume a pickup code as a recipient delivery code",async()=>{
    mock.stage.mockResolvedValueOnce(false);
    const tx={deliveryOtp:{findFirst:mock.findFirst,updateMany:mock.updateMany}} as never;
    expect(await verifyDeliveryOtpInTx(tx,"order","123456","assignment-one","DELIVERY")).toMatchObject({ok:false,error:expect.stringContaining("another handover stage")});
    expect(mock.updateMany).not.toHaveBeenCalled();
  });
  it("consumes a matching stage code only once under DB compare-and-swap",async()=>{
    mock.stage.mockResolvedValueOnce(true);
    const tx={deliveryOtp:{findFirst:mock.findFirst,updateMany:mock.updateMany}} as never;
    expect(await verifyDeliveryOtpInTx(tx,"order","123456","assignment-one","PICKUP")).toMatchObject({ok:true,otpId:"otp-one"});
    expect(mock.stage).toHaveBeenCalledWith("order","otp-one","assignment-one","PICKUP",tx);
    expect(mock.updateMany).toHaveBeenCalledTimes(1);
    expect(mock.updateMany.mock.calls[0][0].where).toMatchObject({id:"otp-one",consumedAt:null});
  });
  it("does not show sender pickup OTP as an active recipient delivery OTP",async()=>{
    mock.stage.mockResolvedValueOnce(false);
    const result=await getDeliveryOtpStatus("order");
    expect(result).toMatchObject({hasActiveOtp:false,sentToEmail:null,canResend:true});
  });
});
