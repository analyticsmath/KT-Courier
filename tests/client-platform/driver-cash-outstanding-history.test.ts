import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({driver:vi.fn(),totals:vi.fn(),wallet:vi.fn(),cash:vi.fn(),remittances:vi.fn(),bank:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{driverProfile:{findUnique:m.driver},cashOnDelivery:{aggregate:m.totals,findMany:m.cash},ledgerAccount:{aggregate:m.wallet},driverCashDeposit:{findMany:m.remittances},systemSetting:{findUnique:m.bank}}}));
import { driverCashSummary } from "@/lib/client-platform/driver-cash.service";
const money=(v:string)=>new Prisma.Decimal(v);
const row=(orderId:string,status:string)=>({orderId,collectorDriverId:"driver-1",authoritativePayable:money("100"),digitalPaid:money("0"),cashObligation:money("100"),cashCollected:money(status==="COLLECTED"?"100":"0"),cashReconciled:money("0"),status,order:{orderNumber:orderId,status:"DELIVERED"}});
beforeEach(()=>{vi.resetAllMocks();m.driver.mockResolvedValue({id:"driver-1",status:"ACTIVE",user:{role:"DRIVER",status:"ACTIVE"}});m.totals.mockResolvedValue({_sum:{cashCollected:money("100"),cashReconciled:money("0")}});m.wallet.mockResolvedValue({_sum:{currentBalance:money("100")}});m.bank.mockResolvedValue(null);m.remittances.mockResolvedValue([]);});
describe("driver cash collections beyond recent history",()=>{
 it("surfaces older unremitted COD cash even when more than 100 newer orders occupy the display window",async()=>{
  const recent=Array.from({length:100},(_,i)=>row(`recent-${i}`,"RECONCILED"));
  const old=row("old-pending-remittance","COLLECTED");
  m.cash.mockResolvedValueOnce(recent).mockResolvedValueOnce([old]);
  const summary=await driverCashSummary("driver-user");
  expect(summary.orders.find(o=>o.orderId==="old-pending-remittance")).toMatchObject({canDeposit:true});
  expect(summary.totals.held).toBe("100.00");
  expect(m.cash).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({AND:expect.arrayContaining([expect.objectContaining({status:{in:["READY_FOR_COLLECTION","COLLECTED"]}})])}),take:101}));
 });
 it("never duplicates the same order when actionable and recent windows overlap",async()=>{
  const open=row("one-open","COLLECTED");
  m.cash.mockResolvedValueOnce([open]).mockResolvedValueOnce([open]);
  const summary=await driverCashSummary("driver-user");
  expect(summary.orders.filter(o=>o.orderId==="one-open")).toHaveLength(1);
 });
});
