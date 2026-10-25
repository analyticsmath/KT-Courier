import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ driver:vi.fn(), collected:vi.fn(), custody:vi.fn(), codRows:vi.fn(), deposits:vi.fn(), bank:vi.fn() }));
vi.mock("@/lib/db/prisma",()=>({prisma:{driverProfile:{findUnique:mocks.driver},cashOnDelivery:{aggregate:mocks.collected,findMany:mocks.codRows},ledgerAccount:{aggregate:mocks.custody},driverCashDeposit:{findMany:mocks.deposits},systemSetting:{findUnique:mocks.bank}}}));
import { driverCashSummary } from "@/lib/client-platform/driver-cash.service";
const orderId="order-older-held-cash";
const cod={orderId,collectorDriverId:"driver-id",authoritativePayable:new Prisma.Decimal("100"),digitalPaid:new Prisma.Decimal(0),cashObligation:new Prisma.Decimal("100"),cashCollected:new Prisma.Decimal("100"),cashReconciled:new Prisma.Decimal(0),status:"COLLECTED",order:{orderNumber:"KT-TEST",status:"DELIVERED"}};
const deposit={id:"old-unreviewed-deposit",orderId,amount:new Prisma.Decimal("100"),bankReference:"BANK-OLD",remittanceMethod:"BANK_DEPOSIT",status:"PENDING",reviewNote:null,createdAt:new Date("2026-01-01"),reviewedAt:null};
beforeEach(()=>{
 vi.resetAllMocks();
 mocks.driver.mockResolvedValue({id:"driver-id",status:"ACTIVE",user:{role:"DRIVER",status:"ACTIVE"}});
 mocks.collected.mockResolvedValue({_sum:{cashCollected:new Prisma.Decimal("100"),cashReconciled:new Prisma.Decimal(0)}});
 mocks.custody.mockResolvedValue({_sum:{currentBalance:new Prisma.Decimal("100")}});
 mocks.codRows.mockResolvedValue([cod]);
 mocks.bank.mockResolvedValue(null);
 mocks.deposits.mockImplementation(async ({where}:{where:Record<string,unknown>})=>where?.orderId?[deposit]:[]);
});
describe("driver cash deposit page boundaries",()=>{
 it("never offers a second deposit if the first pending deposit is beyond the recent 100 rows",async()=>{
  const summary=await driverCashSummary("driver-user");
  expect(summary.deposits).toEqual([]);
  expect(summary.orders[0]?.canDeposit).toBe(false);
  expect(mocks.deposits).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({orderId:{in:[orderId]},driverProfileId:"driver-id",status:{in:["PENDING","PROCESSING","CONFIRMED"]}})}));
 });
 it("allows a first deposit when there is no active remittance for an eligible order",async()=>{
  mocks.deposits.mockResolvedValue([]);
  const summary=await driverCashSummary("driver-user");
  expect(summary.orders[0]?.canDeposit).toBe(true);
 });
});
