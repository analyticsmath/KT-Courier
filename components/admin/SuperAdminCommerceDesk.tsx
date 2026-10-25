"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseCommerceSelection } from "@/lib/super-admin/selection";

type Store={id:string;name:string;status:string};
type Product={id:string;publicReference:string;version:number;title:string;sourceStoreId:string|null;variants:{id:string;title:string;status:string}[]};
type Offer={id:string;storeId:string;storeSku:string;publicReference:string;version:number;product:{title:string};variant:{title:string}};
type Props={stores:Store[];types:{id:string;name:string}[];categories:{id:string;path:string}[];products:Product[];offers:Offer[]};
type Mode="INVITE"|"STORES"|"PRODUCTS"|"BULK"|"MEDIA"|"OFFERS"|"PRICES"|"ATTRIBUTES"|"RECOVERY";
const modes:[Mode,string][]=[["INVITE","Invite vendor"],["STORES","Add store"],["PRODUCTS","New product"],["BULK","CSV import"],["MEDIA","Product images"],["OFFERS","Store listing"],["PRICES","Price version"],["ATTRIBUTES","Priced options"],["RECOVERY","Password reset"]];
const paths=[
 ["Stores","/admin/stores","Review and manage vendors"],
 ["Products","/admin/catalog/products","Moderate catalog items"],
 ["Orders","/admin/orders","Manage delivery and marketplace orders"],
 ["Advertising","/admin/advertising","Review adverts and banner placements"],
 ["Homepage banners","/admin/super-admin/banners","Schedule and review homepage editorial banners"],
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
 const [importOperationId,setImportOperationId]=useState<string|null>(null);
 const [invitationLink,setInvitationLink]=useState<string|null>(null);
 const variants=products.filter(x=>x.sourceStoreId===storeId).flatMap(p=>p.variants.map(v=>({value:JSON.stringify({productId:p.id,variantId:v.id}),label:`${p.title} · ${v.title}`})));
 const prices=offers.filter(x=>x.storeId===storeId).map(o=>({value:JSON.stringify({offerPublicReference:o.publicReference,offerVersion:o.version}),label:`${o.product.title} / ${o.variant.title} · ${o.storeSku}`}));
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setNotice(null);
  const raw=Object.fromEntries(new FormData(e.currentTarget));let data:Record<string,unknown>={...raw};let action="CREATE_STORE";
  try {
  if(mode==="INVITE"){action="INVITE_STORE_OWNER";data={email:raw.email,storeName:raw.storeName,contactName:raw.contactName};}
  if(mode==="PRODUCTS"){action="CREATE_PRODUCT_DRAFT";data={...raw,storeId,scope:"STORE_PRIVATE",condition:"NEW",attributeValues:{},complianceValues:{},operationId:crypto.randomUUID()};}
  if(mode==="OFFERS"){action="CREATE_OFFER_DRAFT";data={...parseCommerceSelection(String(raw.variantSelection ?? ""),["productId","variantId"]),storeId,storeSku:raw.storeSku,sellingUnit:raw.sellingUnit,inventoryTrackingMode:raw.inventoryTrackingMode,fulfilmentMode:"COURIER_DELIVERY",quantityStep:raw.quantityStep,minimumQuantity:raw.minimumQuantity,...(["PAIR","PACK","BULK"].includes(String(raw.sellingUnit))?{packagedQuantity:raw.packagedQuantity,unitOfMeasure:raw.unitOfMeasure}:{}),operationId:crypto.randomUUID()};}
  if(mode==="PRICES"){
    action="CREATE_PRICE_DRAFT";
    const tiers=String(raw.volumeTiers??"").trim();
    const volumeTiers=tiers?tiers.split(/\r?\n/).map(line=>{
      const parts=line.split(":");
      if(parts.length!==2||!/^\d{1,2}$/.test(parts[0].trim()))throw new Error("Use quantity:price format, e.g. 3:90.00, one discount tier per line.");
      return {minQuantity:Number(parts[0].trim()),unitPrice:parts[1].trim()};
    }):[];
    data={...parseCommerceSelection(String(raw.offer ?? ""),["offerPublicReference","offerVersion"]),storeId,amount:raw.amount,currency:"ZAR",priceIncludesTax:true,effectiveFrom:new Date(String(raw.effectiveFrom)).toISOString(),reasonCode:"ADMIN_PRICE_DRAFT",volumeTiers,operationId:crypto.randomUUID()};
  }
  if(mode==="ATTRIBUTES"){
   action="CREATE_PRICED_ATTRIBUTES";
   const offer=parseCommerceSelection<{offerPublicReference:string}>(String(raw.offer ?? ""),["offerPublicReference"]);
   const selected=offers.find(x=>x.publicReference===offer.offerPublicReference&&x.storeId===storeId);
   data={storeId,offerId:selected?.id,name:raw.groupName,minimumSelections:1,maximumSelections:1,isRequired:true,options:[
    {name:raw.optionName,priceDelta:raw.optionPrice,currency:"ZAR",displayOrder:0}
   ],operationId:crypto.randomUUID()};
  }
  if(mode==="BULK") {
    action="IMPORT_PRODUCT_DRAFTS";
    const selectedFile=raw.catalogCsvFile;
    if(!(selectedFile instanceof File)||!selectedFile.name.toLowerCase().endsWith(".csv")||selectedFile.size>64000||selectedFile.size<1)throw new Error("Choose a CSV file up to 64 KB with title and optional shortDescription columns.");
    data={storeId,productTypeDefinitionId:raw.productTypeDefinitionId,primaryCategoryId:raw.primaryCategoryId,csv:await selectedFile.text(),operationId:importOperationId??crypto.randomUUID(),dryRun:raw.dryRun==="true"};
  }
  if(mode==="MEDIA") {
    const selectedFile=raw.productImageFile;
    const product=products.find(x=>x.publicReference===raw.productReference&&x.sourceStoreId===storeId);
    if(!product)throw new Error("Choose a draft product belonging to the selected store.");
    if(!(selectedFile instanceof File)||!(["image/jpeg","image/png","image/webp"].includes(selectedFile.type))||selectedFile.size<1||selectedFile.size>8*1024*1024)throw new Error("Choose an approved JPEG, PNG or WebP image smaller than 8 MB.");
    const base=crypto.randomUUID();
    const start=await fetch("/api/admin/super-admin/media",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"START_MEDIA_UPLOAD",data:{storeId,purpose:"PRODUCT_IMAGE",declaredMimeType:selectedFile.type,declaredByteSize:selectedFile.size,operationId:`${base}-start`}})});
    const intent=await start.json();if(!start.ok)throw new Error(intent.error??"Image upload request rejected.");
    const uploadRef=String(intent.upload?.publicReference??"");
    if(!/^CMU-[A-F0-9]{32}$/.test(uploadRef))throw new Error("Media service returned an invalid upload reference.");
    const bytes=await fetch(`/api/admin/super-admin/media/${uploadRef}/content`,{method:"POST",headers:{"Content-Type":"application/octet-stream","X-KT-Store-Id":storeId,"X-Catalog-Operation-Id":`${base}-bytes`},body:await selectedFile.arrayBuffer()});
    const uploaded=await bytes.json();if(!bytes.ok)throw new Error(uploaded.error??"Image upload failed.");
    const finish=await fetch("/api/admin/super-admin/media",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"COMPLETE_AND_ATTACH_MEDIA",data:{storeId,uploadReference:uploadRef,productReference:product.publicReference,productVersion:product.version,altText:String(raw.altText??""),operationId:`${base}-complete`}})});
    const result=await finish.json();if(!finish.ok)throw new Error(result.error??"Image validation or attachment failed.");
    setNotice({ok:true,value:"Image inspected and attached to the unpublished product draft. Moderation is still required before publication."});router.refresh();return;
  }
  if(mode==="RECOVERY")data={email:raw.email};
   const response=await fetch(mode==="RECOVERY"?"/api/admin/super-admin/password-reset":"/api/admin/super-admin/commerce",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="RECOVERY"?data:{action,data})});
   const outcome=await response.json();if(!response.ok)throw new Error(outcome.error??"Operation rejected.");
   const labels:Record<Mode,string>={INVITE:"New vendor invitation created. Copy the secure link and send it privately to the business owner.",STORES:"Pending store created. Independent vendor approval remains required.",PRODUCTS:"Unpublished product draft created.",BULK:"Product CSV verified or draft import completed. Review the batch details before submitting any products for approval.",MEDIA:"Product media uploaded for independent review.",OFFERS:"Store listing drafted; inventory and publication require review.",PRICES:"Price version drafted; live checkout pricing unchanged.",ATTRIBUTES:"Draft offer option created and linked. It still requires independent publication review.",RECOVERY:"If eligible, this account will receive secure password reset instructions."};
   if(mode==="INVITE"){
     const link=String(outcome.invitation?.signupUrl??"");
     setInvitationLink(link.startsWith("/signup?")?window.location.origin+link:null);
     setNotice({ok:true,value:"Invitation created. Only the invited vendor may use it for registration; store approval remains independent."});
   }else if(mode==="BULK"){
     const batch=outcome.batch as {preview:boolean;count:number;replayed?:boolean;rows?:unknown[];batchReference?:string};
     setNotice({ok:true,value:batch.preview?`CSV valid: ${batch.count} rows. No products created. Uncheck Dry run to create unpublished drafts.`:`${batch.replayed?"Existing import found":"Created"}: ${batch.count} unpublished product drafts. Batch ${batch.batchReference??"recorded"}.`});
     if(batch.preview)setImportOperationId(String(data.operationId));
     else setImportOperationId(null);
   }else setNotice({ok:true,value:labels[mode]});router.refresh();
  }catch(error){setNotice({ok:false,value:error instanceof Error?error.message:"Could not submit."});}finally{setBusy(false);}
 }
 return <div className="space-y-8">
 <nav aria-label="Super Admin commerce destinations" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{paths.map(([title,href,description])=><Link key={title} href={href} className="flex min-h-24 flex-col justify-between rounded-xl border border-[var(--kt-border)] bg-white p-5 hover:border-[var(--kt-brand-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"><strong className="text-sm text-[var(--kt-brand-navy)]">{title} ↗</strong><span className="mt-3 text-sm text-[var(--kt-text-soft)]">{description}</span></Link>)}</nav>
 <section className="overflow-hidden rounded-xl border border-[var(--kt-border)] bg-white"><div className="border-b border-[var(--kt-border)] p-6"><h2 className="text-xl font-semibold text-[var(--kt-brand-navy)]">Managed store authoring</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kt-text-soft)]">Create attributed draft records and secure account-recovery requests. Store approval, pricing activation and campaign publication remain separately governed.</p></div>
 <div className="grid lg:grid-cols-[225px_minmax(0,1fr)]"><nav aria-label="Authoring modes" className="flex gap-1 overflow-x-auto border-b border-[var(--kt-border)] p-3 lg:flex-col lg:border-b-0 lg:border-r">{modes.map(([key,label])=><button key={key} type="button" aria-pressed={mode===key} onClick={()=>{setMode(key);setNotice(null);}} className={`min-w-max rounded-lg px-4 py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)] lg:min-w-0 ${mode===key?"bg-[var(--kt-brand-navy)] text-white":"text-[var(--kt-brand-navy)] hover:bg-[var(--kt-surface-muted)]"}`}>{label}</button>)}</nav><div className="min-w-0 space-y-6 p-6"><h3 className="text-lg font-semibold text-[var(--kt-brand-navy)]">{modes.find(x=>x[0]===mode)?.[1]}</h3>
 {mode!=="STORES"&&mode!=="INVITE"&&mode!=="RECOVERY"&&<label className="grid max-w-xl gap-2 text-sm font-medium">Store<select value={storeId} onChange={e=>setStoreId(e.target.value)} className={cls}>{stores.map(x=><option value={x.id} key={x.id}>{x.name} ({x.status.toLowerCase()})</option>)}</select></label>}
 <form key={mode} onSubmit={e=>void submit(e)} className="grid max-w-3xl gap-5 sm:grid-cols-2">
 {mode==="INVITE"&&<><Field name="storeName" label="Proposed store trading name"/><Field name="email" type="email" label="New vendor email"/><Field name="contactName" label="Vendor contact person"/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">A time-limited registration link is issued to Super Admin. The vendor chooses their own password, verifies email, and the new store remains pending approval. No Super Admin login details are shared.</p></>}
 {mode==="STORES"&&<><Field name="name" label="Store trading name"/><Field name="ownerEmail" label="Verified vendor email" type="email"/><Field name="contactName" label="Contact person"/><Field name="contactPhone" label="Contact number" required={false}/><Field name="addressLine1" label="Collection street address" required={false}/><Field name="city" label="City" required={false}/><Field name="province" label="Province" defaultValue="Gauteng" required={false}/><Field name="postalCode" label="Postal code" required={false}/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">The vendor must have an existing verified STORE account, without another linked store. The new store starts pending approval.</p></>}
 {mode==="PRODUCTS"&&<><Choice name="productTypeDefinitionId" label="Approved product type" items={types.map(t=>({value:t.id,label:t.name}))}/><Choice name="primaryCategoryId" label="Category" items={categories.map(c=>({value:c.id,label:c.path}))}/><Field name="title" label="Product name"/><Field name="shortDescription" label="Short description" required={false}/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">The product is saved as a store-private draft. Add imagery, verified dimensions and compliance evidence before submitting for approval.</p></>}
 {mode==="BULK"&&<><Choice name="productTypeDefinitionId" label="Approved product type for all rows" items={types.map(t=>({value:t.id,label:t.name}))}/><Choice name="primaryCategoryId" label="Category for all rows" items={categories.map(c=>({value:c.id,label:c.path}))}/><label className="grid gap-2 text-sm font-medium sm:col-span-2">CSV file (.csv, up to 100 rows / 64 KB)<input className={cls} name="catalogCsvFile" type="file" accept=".csv,text/csv" required /></label><label className="flex items-center gap-3 rounded-lg border border-[var(--kt-border)] p-4 text-sm font-medium sm:col-span-2"><input name="dryRun" type="checkbox" value="true" defaultChecked /><span>Dry run only — validate before creating unpublished product drafts</span></label><p className="sm:col-span-2 text-sm leading-6 text-[var(--kt-text-soft)]">Required CSV header: <code>title,shortDescription</code>. Example: <code>&quot;Red apples 1kg&quot;,&quot;Fresh local apples&quot;</code>. Import is all-or-nothing and audited. Images, prices, stock and independent publication approvals must be completed separately.</p></>}
 {mode==="MEDIA"&&<><Choice name="productReference" label="Unpublished store product" items={products.filter(x=>x.sourceStoreId===storeId).map(p=>({value:p.publicReference,label:p.title}))}/><Field name="altText" label="Accessible image description"/><label className="grid gap-2 text-sm font-medium sm:col-span-2">Product image (JPEG, PNG, WebP up to 8 MB)<input className={cls} type="file" name="productImageFile" accept="image/jpeg,image/png,image/webp" required /></label><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">Image bytes are privately uploaded and inspected through the canonical catalog media service. Only DRAFT products may receive new media. Product publication requires separate approval.</p></>}
 {mode==="OFFERS"&&<><Choice name="variantSelection" label="Store product variant" items={variants}/><Field name="storeSku" label="Store SKU"/><Choice name="sellingUnit" label="Selling unit" items={["EACH","PAIR","PACK","BULK","FIXED_WEIGHT","VARIABLE_WEIGHT","VOLUME","LENGTH"].map(x=>({value:x,label:x.replaceAll("_"," ")}))}/><Choice name="inventoryTrackingMode" label="Inventory method" items={["TRACKED","UNTRACKED","MADE_TO_ORDER"].map(x=>({value:x,label:x.replaceAll("_"," ")}))}/><Field name="quantityStep" label="Quantity step" defaultValue="1"/><Field name="minimumQuantity" label="Minimum quantity" defaultValue="1"/><Field name="packagedQuantity" label="Pack contents (2 for pair, 6 for six-pack)" required={false}/><Field name="unitOfMeasure" label="Package contents unit (e.g. piece)" required={false}/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">PAIR, PACK and BULK are separate sellable SKUs, with stock measured in complete packs—not loose pieces. Declare contents per pack and measured delivery packaging before approval.</p></>}
 {mode==="PRICES"&&<><Choice name="offer" label="Store offer / variant" items={prices}/><Field name="amount" label="Proposed price (ZAR)"/><Field name="effectiveFrom" label="Effective from" type="datetime-local"/><label className="sm:col-span-2 grid gap-2 text-sm font-medium">Quantity discount tiers (optional)<textarea className={cls} name="volumeTiers" rows={3} placeholder={"3:90.00\n10:80.00"} /><small className="text-[var(--kt-text-soft)]">One quantity:unit-price line per tier. Minimum quantity 2–99. Discounts must increase with quantity and never raise the effective price.</small></label><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">This only creates a versioned draft. Discount and coupon activation must use the separate Promotions approvals.</p></>}
 {mode==="ATTRIBUTES"&&<><Choice name="offer" label="Draft store offer" items={offers.filter(o=>o.storeId===storeId).map(o=>({value:JSON.stringify({offerPublicReference:o.publicReference}),label:`${o.product.title} · ${o.variant.title} — ${o.storeSku}`}))}/><Field name="groupName" label="Option group (e.g. Size)"/><Field name="optionName" label="Selection (e.g. Large)"/><Field name="optionPrice" label="Price addition (ZAR, e.g. 12.50)"/><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">Price additions can be created only on draft store offers. Live products must follow independent approval and publication; do not change existing checkout prices directly.</p></>}
 {mode==="RECOVERY"&&<><div className="sm:col-span-2"><Field name="email" label="Account holder email" type="email"/></div><p className="sm:col-span-2 text-sm text-[var(--kt-text-soft)]">Only verified eligible accounts receive the secure reset link. No administrator can view or set the password, and privileged admins recover their own credentials independently.</p></>}
 {mode==="INVITE"&&invitationLink&&<div className="sm:col-span-2 space-y-3 rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface-muted)] p-4"><p className="text-sm font-semibold">Private vendor registration link</p><code className="block break-all text-xs">{invitationLink}</code><button type="button" onClick={()=>void navigator.clipboard.writeText(invitationLink)} className="min-h-11 rounded-full border border-[var(--kt-border)] bg-white px-5 text-sm font-semibold">Copy invitation link</button><p className="text-xs text-[var(--kt-text-soft)]">Treat this link as a secret. Share only with the intended vendor. Expires after 72 hours.</p></div>}
 {notice&&<p role="status" className={`sm:col-span-2 rounded-lg border p-4 text-sm ${notice.ok?"border-[#b5d8c9] bg-[#eef8f2] text-[#246447]":"border-[#e6bbbb] bg-[#fff2f2] text-[#953a3a]"}`}>{notice.value}</p>}
 <div className="sm:col-span-2"><button disabled={busy||(!storeId&&mode!=="STORES"&&mode!=="RECOVERY")} type="submit" className="min-h-12 rounded-full bg-[var(--kt-brand-navy)] px-6 py-3 text-sm font-semibold text-white hover:opacity-85 disabled:opacity-50">{busy?"Saving securely…":mode==="RECOVERY"?"Send reset instructions":mode==="INVITE"?"Create registration invitation":mode==="STORES"?"Create pending store":mode==="BULK"?"Validate or create draft batch":mode==="MEDIA"?"Validate and attach image":"Save draft for review"}</button></div>
 </form></div></div></section></div>;
}
