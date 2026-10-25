"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseCommerceSelection } from "@/lib/super-admin/selection";

type Store={id:string;name:string;status:string};
type Product={id:string;title:string;sourceStoreId:string|null;variants:{id:string;title:string;status:string}[]};
type Offer={id:string;storeId:string;storeSku:string;publicReference:string;version:number;product:{title:string};variant:{title:string}};
type Props={stores:Store[];types:{id:string;name:string}[];categories:{id:string;path:string}[];products:Product[];offers:Offer[]};
type Mode="STORES"|"PRODUCTS"|"OFFERS"|"PRICES"|"ATTRIBUTES"|"RECOVERY";
const modes:[Mode,string][]=[["STORES","Add store"],["PRODUCTS","New product"],["OFFERS","Store listing"],["PRICES","Price version"],["ATTRIBUTES","Priced options"],["RECOVERY","Password reset"]];
const paths=[
 ["Stores","/admin/stores","Review and manage vendors"],
 ["Products","/admin/catalog/products","Moderate catalog items"],
 ["Orders","/admin/orders","Manage delivery and marketplace orders"],
 ["Advertising","/admin/advertising","Review adverts and banner placements"],
 ["Coupons","/admin/promotions","Review promotional discounts and codes"],
 ["Refer and earn","/admin/promoter-programs","Manage referral programme governance"],
 ["Offers","/admin/catalog/offers","Review units, variants and prices"],
 ["Creatives","/admin/promoter-assets","Review marketing assets"],
] as const;
const cls="min-h-12 w-full rounded-lg border border-[var(--kt-border)] bg-white px-3 py-2 text-sm text-[var(--kt-brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]";
function Field({name,label,type="text",required=true,defaultValue}:{name:string;label:string;type?:string;required?:boolean;defaultValue?:string}){return <label className="grid gap-2 text-sm font-medium">{label}<input className={cls} name={name} type={type} required={required} defaultValue={defaultValue}/></label>;}
function Choice({name,label,items}:{name:string;label:string;items:{value:string;label:string}[]}){return <label className="grid gap-2 text-sm font-medium">{label}<select className={cls} name={name} required defaultValue=""><option value="" disabled>Select {label.toLowerCase()}</option>{items.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;}
export function SuperAdminCommerceDesk({stores,types,categories,products,offers}:Props){
 const router=useRouter();const [mode,setMode]=useState<Mode>("STORES");const [storeId,setStoreId]=useState(stores[0]?.id??"");
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState<{ok:boolean;value:string}|null>(null);
 const variants=products.filter(x=>x.sourceStoreId===storeId).flatMap(p=>p.variants.map(v=>({value:JSON.stringify({productId:p.id,variantId:v.id}),label:`${p.title} · ${v.title}`})));
 const prices=offers.filter(x=>x.storeId===storeId).map(o=>({value:JSON.stringify({offerPublicReference:o.publicReference,offerVersion:o.version}),label:`${o.product.title} / ${o.variant.title} · ${o.storeSku}`}));
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setNotice(null);
  const raw=Object.fromEntries(new FormData(e.currentTarget));let data:Record<string,unknown>={...raw};let action="CREATE_STORE";
  try {
  if(mode==="PRODUCTS"){action="CREATE_PRODUCT_DRAFT";data={...raw,storeId,scope:"STORE_PRIVATE",condition:"NEW",attributeValues:{},complianceValues:{},operationId:crypto.randomUUID()};}
  if(mode==="OFFERS"){action="CREATE_OFFER_DRAFT";data={...parseCommerceSelection(String(raw.variantSelection ?? ""),["productId","variantId"]),storeId,storeSku:raw.storeSku,sellingUnit:raw.sellingUnit,inventoryTrackingMode:raw.inventoryTrackingMode,fulfilmentMode:"COURIER_DELIVERY",quantityStep:raw.quantityStep,minimumQuantity:raw.minimumQuantity,operationId:crypto.randomUUID()};}
  if(mode==="PRICES"){action="CREATE_PRICE_DRAFT";data={...parseCommerceSelection(String(raw.offer ?? ""),["offerPublicReference","offerVersion"]),storeId,amount:raw.amount,currency:"ZAR",priceIncludesTax:true,effectiveFrom:new Date(String(raw.effectiveFrom)).toISOString(),reasonCode:"ADMIN_PRICE_DRAFT",operationId:crypto.randomUUID()};}
  if(mode==="ATTRIBUTES"){
   action="CREATE_PRICED_ATTRIBUTES";
   const offer=parseCommerceSelection<{offerPublicReference:string}>(String(raw.offer ?? ""),["offerPublicReference"]);
   const selected=offers.find(x=>x.publicReference===offer.offerPublicReference&&x.storeId===storeId);
   data={storeId,offerId:selected?.id,name:raw.groupName,minimumSelections:1,maximumSelections:1,isRequired:true,options:[
    {name:raw.optionName,priceDelta:raw.optionPrice,currency:"ZAR",displayOrder:0}
   ],operationId:crypto.randomUUID()};
  }
  if(mode==="RECOVERY")data={email:raw.email};
   const response=await fetch(mode==="RECOVERY"?"/api/admin/super-admin/password-reset":"/api/admin/super-admin/commerce",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="RECOVERY"?data:{action,data})});
   const outcome=await response.json();if(!response.ok)throw new Error(outcome.error??"Operation rejected.");
   const labels:Record<Mode,string>={STORES:"Pending store created. Independent vendor approval remains required.",PRODUCTS:"Unpublished product draft created.",OFFERS:"Store listing drafted; inventory and publication require review.",PRICES:"Price version drafted; live checkout pricing unchanged.",ATTRIBUTES:"Draft offer option created and linked. It still requires independent publication review.",RECOVERY:"If eligible, this account will receive secure password reset instructions."};
   setNotice({ok:true,value:labels[mode]});router.refresh();
  }catch(error){setNotice({ok:false,value:error instanceof Error?error.message:"Could not submit."});}finally{setBusy(false);}
 }
 return <div className="space-y-8">
 <nav aria-label="Super Admin commerce destinations" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{paths.map(([title,href,description])=><Link key={title} href={href} className="flex min-h-24 flex-col justify-between rounded-xl border border-[var(--kt-border)] bg-white p-5 hover:border-[var(--kt-brand-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"><strong className="text-sm text-[var(--kt-brand-navy)]">{title} ↗</strong><span className="mt-3 text-sm text-[var(--kt-text-soft)]">{description}</span></Link>)}</nav>
 <section className="overflow-hidden rounded-xl border border-[var(--kt-border)] bg-white"><div className="border-b border-[var(--kt-border)] p-6"><h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Managed store authoring</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kt-text-soft)]">Create attributed draft records and secure account-recovery requests. Store approval, pricing activation and campaign publication remain separately governed.</p></div>
 <div className="grid lg:grid-cols-[225px_minmax(0,1fr)]"><nav aria-label="Authoring modes" className="flex gap-1 overflow-x-auto border-b border-[var(--kt-border)] p-3 lg:flex-col lg:border-b-0 lg:border-r">{modes.map(([key,label])=><button key={key} type="button" aria-pressed={mode===key} onClick={()=>{setMode(key);setNotice(null);}} className={`min-w-max rounded-lg px-4 py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)] lg:min-w-0 ${mode===key?"bg-[var(--kt-brand-navy)] text-white":"text-[var(--kt-brand-navy)] hover:bg-[var(--kt-surface-muted)]"}`}>{label}</button>)}</nav><div className="min-w-0 space-y-6 p-6"><h3 className="text-lg font-semibold text-[var(--kt-brand-navy)]">{modes.find(x=>x[0]===mode)?.[1]}</h3>
 {mode!=="STORES"&&mode!=="RECOVERY"&&<label className="grid max-w-xl gap-2 text-sm font-medium">Store<select value={storeId} onChange={e=>setStoreId(e.target.value)} className={cls}>{stores.map(x=><option value={x.id} key={x.id}>{x.name} ({x.status.toLowerCase()})</option>)}</select></label>}
 <form key={mode} onSubmit={e=>void submit(e)} className="grid max-w-3xl gap-5 sm:grid-cols-2">
 {mode==="STORES"&&<><Field name="name" label="Store trading name"/><Field name="ownerEmail" label="Verified vendor email" type="email"/><Field name="contactName" label="Contact person"/><Field name="contactPhone" label="Contact number" required={false}/><Field name="addressLine1" label="Collection street address" required={false}/><Field name="city" label="City" required={false}/><Field name="province" label="Province" defaultValue="Gauteng" required={false}/><Field name="postalCode" label="Postal code" required={false}/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">The vendor must have an existing verified STORE account, without another linked store. The new store starts pending approval.</p></>}
 {mode==="PRODUCTS"&&<><Choice name="productTypeDefinitionId" label="Approved product type" items={types.map(t=>({value:t.id,label:t.name}))}/><Choice name="primaryCategoryId" label="Category" items={categories.map(c=>({value:c.id,label:c.path}))}/><Field name="title" label="Product name"/><Field name="shortDescription" label="Short description" required={false}/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">The product is saved as a store-private draft. Add imagery, verified dimensions and compliance evidence before submitting for approval.</p></>}
 {mode==="OFFERS"&&<><Choice name="variantSelection" label="Store product variant" items={variants}/><Field name="storeSku" label="Store SKU"/><Choice name="sellingUnit" label="Selling unit" items={["EACH","FIXED_WEIGHT","VARIABLE_WEIGHT","VOLUME","LENGTH"].map(x=>({value:x,label:x.replaceAll("_"," ")}))}/><Choice name="inventoryTrackingMode" label="Inventory method" items={["TRACKED","UNTRACKED","MADE_TO_ORDER"].map(x=>({value:x,label:x.replaceAll("_"," ")}))}/><Field name="quantityStep" label="Quantity step" defaultValue="1"/><Field name="minimumQuantity" label="Minimum quantity" defaultValue="1"/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">Pairs and bulk packs require real product/packaging variant definitions. Quantity discounts are not applied automatically; unverified unit prices must not reach checkout.</p></>}
 {mode==="PRICES"&&<><Choice name="offer" label="Store offer / variant" items={prices}/><Field name="amount" label="Proposed price (ZAR)"/><Field name="effectiveFrom" label="Effective from" type="datetime-local"/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">This only creates a versioned draft. Discount and coupon activation must use the separate Promotions approvals.</p></>}
 {mode==="ATTRIBUTES"&&<><Choice name="offer" label="Draft store offer" items={offers.filter(o=>o.storeId===storeId).map(o=>({value:JSON.stringify({offerPublicReference:o.publicReference}),label:`${o.product.title} · ${o.variant.title} — ${o.storeSku}`}))}/><Field name="groupName" label="Option group (e.g. Size)"/><Field name="optionName" label="Selection (e.g. Large)"/><Field name="optionPrice" label="Price addition (ZAR, e.g. 12.50)"/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">Price additions can be created only on draft store offers. Live products must follow independent approval and publication; do not change existing checkout prices directly.</p></>}
 {mode==="RECOVERY"&&<><div className="sm:col-span-2"><Field name="email" label="Account holder email" type="email"/></div><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">Only verified eligible accounts receive the secure reset link. No administrator can view or set the password, and privileged admins recover their own credentials independently.</p></>}
 {notice&&<p role="status" className={`sm:col-span-2 rounded-lg border p-4 text-sm ${notice.ok?"border-[#b5d8c9] bg-[#eef8f2] text-[#246447]":"border-[#e6bbbb] bg-[#fff2f2] text-[#953a3a]"}`}>{notice.value}</p>}
 <div className="sm:col-span-2"><button disabled={busy||(!storeId&&mode!=="STORES"&&mode!=="RECOVERY")} type="submit" className="min-h-12 rounded-full bg-[var(--kt-brand-navy)] px-6 py-3 text-sm font-semibold text-white hover:opacity-85 disabled:opacity-50">{busy?"Saving securely…":mode==="RECOVERY"?"Send reset instructions":mode==="STORES"?"Create pending store":"Save draft for review"}</button></div>
 </form></div></div></section></div>;
}
