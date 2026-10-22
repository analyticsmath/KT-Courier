"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type OwnerOption={type:string;id:string;label:string};
type Rate={id:string;ownerType:string;ownerId:string;serviceKey:string;parcelSize:string;versionNumber:number;status:string;baseFee:string;perKmRate:string;minimumCharge:string|null;effectiveFrom:string;effectiveTo:string|null};
const services=[["CLIENT_ECONOMY","Economy"],["CLIENT_STANDARD","Standard"],["CLIENT_EXPRESS","Express"]] as const;
export function PersonalizedRatesManager({owners,rates}:{owners:OwnerOption[];rates:Rate[]}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [reason,setReason]=useState("Approved tailored delivery tariff for this account.");
  async function send(method:"POST"|"PATCH",payload:Record<string,unknown>){
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const res=await fetch("/api/admin/pricing/personalized-rates",{
        method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
      });
      const obj=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(obj.error||"The pricing operation could not be completed.");
      setNotice(method==="POST"?"Rate draft created; activate only after reviewing the agreed commercial terms.":"Rate status updated.");
      router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Pricing operation failed.");}
    finally{setBusy(false);}
  }
  function create(form:HTMLFormElement){
    const d=new FormData(form);
    const account=String(d.get("owner")||"");
    const option=owners.find(o=>`${o.type}:${o.id}`===account);
    if(!option){setError("Choose an eligible account.");return;}
    const effectiveTo=String(d.get("effectiveTo")||"");
    void send("POST",{
      ownerType:option.type,ownerId:option.id,serviceKey:String(d.get("serviceKey")),
      parcelSize:String(d.get("parcelSize")),
      baseFee:String(d.get("baseFee")),perKmRate:String(d.get("perKmRate")),
      minimumCharge:String(d.get("minimumCharge")).trim()||null,
      effectiveFrom:new Date().toISOString(),
      effectiveTo:effectiveTo?new Date(effectiveTo).toISOString():null,
      reason:String(d.get("reason")),
    });
  }
  return <div className="space-y-7">
    <p className="text-sm">Assign negotiated delivery pricing to an individual store without changing publicly advertised tariffs for other stores or guest customers. A R170 base fee plus R0/km is a flat base charge; configured surcharges and VAT may still apply. Rates must be approved and activated before use.</p>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={event=>{event.preventDefault();create(event.currentTarget);}}>
      <label className="text-sm">Customer or store
        <select name="owner" required defaultValue="" className="mt-1 w-full rounded-lg border p-3" >
          <option value="" disabled>Choose account</option>
          {owners.map(o=><option key={o.type+o.id} value={`${o.type}:${o.id}`}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Service
        <select name="serviceKey" className="mt-1 w-full rounded-lg border p-3">
          {services.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="text-sm">Parcel size
        <select name="parcelSize" className="mt-1 w-full rounded-lg border p-3">
          {["SMALL","MEDIUM","LARGE"].map(v=><option key={v} value={v}>{v.toLowerCase()}</option>)}
        </select>
      </label>
      <label className="text-sm">Base fee (R)
        <input type="number" name="baseFee" min="0" max="99999" step="0.01" required defaultValue="129.00" className="mt-1 w-full rounded-lg border p-3" />
      </label>
      <label className="text-sm">Per kilometre (R)
        <input type="number" name="perKmRate" min="0" max="9999" step="0.0001" required defaultValue="0" className="mt-1 w-full rounded-lg border p-3" />
      </label>
      <label className="text-sm">Minimum charge (R, optional)
        <input type="number" name="minimumCharge" min="0" max="99999" step="0.01" className="mt-1 w-full rounded-lg border p-3" />
      </label>
      <label className="text-sm">Expiry date and time (optional)
        <input type="datetime-local" name="effectiveTo" className="mt-1 w-full rounded-lg border p-3" />
      </label>
      <label className="text-sm">Commercial approval reason
        <input name="reason" minLength={12} maxLength={500} required value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border p-3" />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy||!owners.length} className="rounded-lg border px-5 py-3 font-semibold disabled:opacity-60">Create rate draft</button>
      </div>
    </form>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
    <section className="space-y-2" aria-label="Account-specific rate versions">
      <h3 className="font-semibold">Personalized tariff versions</h3>
      {rates.length===0&&<p className="text-sm">No personalized rates configured. Public tariffs remain in effect.</p>}
      {rates.map(rate=><article key={rate.id} className="border-b py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm"><strong>{owners.find(x=>x.id===rate.ownerId&&x.type===rate.ownerType)?.label??`${rate.ownerType} · ${rate.ownerId}`}</strong>
            <p>{rate.serviceKey.replace("CLIENT_","")} / {rate.parcelSize} · R{rate.baseFee} base + R{rate.perKmRate}/km · v{rate.versionNumber}</p>
            <p>Status: {rate.status} · Starts {new Date(rate.effectiveFrom).toLocaleString("en-ZA")}{rate.effectiveTo?` · Ends ${new Date(rate.effectiveTo).toLocaleString("en-ZA")}`:""}</p>
          </div>
          {["DRAFT","ACTIVE"].includes(rate.status)&&<button type="button" disabled={busy||reason.trim().length<12} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-60" onClick={()=>void send("PATCH",{id:rate.id,expectedVersion:rate.versionNumber,reason,action:rate.status==="DRAFT"?"ACTIVATE":"DEACTIVATE"})}>{rate.status==="DRAFT"?"Activate approved tariff":"Deactivate tariff"}</button>}
        </div>
      </article>)}
    </section>
  </div>;
}
