import { describe,expect,it,vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:()=>{}})}));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SuperAdminCommerceDesk } from "@/components/admin/SuperAdminCommerceDesk";

describe("Super Admin commerce navigation and authoring",()=>{
 it("provides accessible store onboarding, approval, coupons, adverts, referral, reset and variant pricing without bypassing publication",()=>{
  const html=renderToStaticMarkup(createElement(SuperAdminCommerceDesk,{stores:[],types:[],categories:[],products:[],offers:[]}));
  for(const label of ["Add store","New product","Store listing","Price version","Password reset","Refer and earn","Coupons","Advertising","Product"])expect(html).toContain(label);
  expect(html).toContain("verified STORE account");
  expect(html).toContain("pending approval");
  expect(html).toContain("/admin/catalog/products");
 });
});
