import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({deposits:vi.fn(),permission:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{driverCashDeposit:{findMany:m.deposits}}}));
vi.mock("@/lib/auth/permissions",()=>({hasPermission:m.permission}));
import { listCashDeposits } from "@/lib/client-platform/driver-cash.service";
import type { AuthenticatedUser } from "@/types/domain";
const actor={id:"finance",role:"SUPER_ADMIN",status:"ACTIVE"} as AuthenticatedUser;
const d=(id:string,status:string,date:string)=>({id,driver:{driverCode:"DR-1",displayName:"Test driver"},order:{orderNumber:`KT-${id}`},amount:new Prisma.Decimal("125.50"),bankReference:`REF-${id}`,remittanceMethod:"BANK_DEPOSIT",status,reviewNote:null,createdAt:new Date(date)});
beforeEach(()=>{vi.clearAllMocks();m.permission.mockResolvedValue(true)});
describe("finance cash review queue",()=>{
 it("shows oldest open cash review even if more than 100 newer historical deposits exist",async()=>{
  m.deposits.mockImplementation(async (query:{where?:{status?:unknown}})=>(query.where?.status && typeof query.where.status === "object" && "in" in query.where.status) ? [d("older-pending","PENDING","2026-01-01")] : [d("closed-recent","CONFIRMED","2026-10-25")]);
  const items=await listCashDeposits(actor);
  expect(items.map(x=>x.id)).toEqual(["older-pending","closed-recent"]);
  expect(m.deposits).toHaveBeenCalledWith(expect.objectContaining({where:{status:{in:["PENDING","PROCESSING"]}},orderBy:{createdAt:"asc"},take:100}));
  expect(m.deposits).toHaveBeenCalledWith(expect.objectContaining({where:{status:{notIn:["PENDING","PROCESSING"]}},orderBy:{createdAt:"desc"},take:100}));
 });
 it("denies admin without cash finance scope",async()=>{
  m.permission.mockResolvedValue(false);
  await expect(listCashDeposits(actor)).rejects.toMatchObject({code:"CASH_REVIEW_FORBIDDEN"});
  expect(m.deposits).not.toHaveBeenCalled();
 });
});
