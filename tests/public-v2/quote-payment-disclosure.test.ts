import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/current-user", () => ({getCurrentUser:vi.fn(async()=>null)}));
vi.mock("@/components/forms/PublicDeliveryQuoteForm", () => ({PublicDeliveryQuoteForm:()=>null}));
vi.mock("@/components/public-v3/redesign/EditorialMotion", () => ({EditorialMotion:({children}:{children:React.ReactNode})=>children}));
vi.mock("@/lib/public-site/site-metadata", () => ({publicPageMetadata:()=>({title:"Delivery quote"})}));
import QuotePage from "@/app/(public)/quote/page";

describe("public parcel quote payment disclosure",()=>{
 it("explains payment selection occurs at booking without promising universal cash eligibility",async()=>{
   const markup=renderToStaticMarkup(await QuotePage({searchParams:Promise.resolve({})}));
   expect(markup).toMatch(/no account (?:is )?needed to start/i);
   expect(markup).toMatch(/online payment/i);
   expect(markup).toMatch(/cash on delivery/i);
   expect(markup).toMatch(/only if approved|if (?:it is )?available/i);
 });
});
