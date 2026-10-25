"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BannerApproved, BannerDraft } from "@/lib/super-admin/home-banner";

type State={version:number;draft:(Omit<BannerDraft,"expectedVersion">&{createdByUserId:string;createdAt:string})|null;active:BannerApproved|null};
const inputClass="min-h-12 w-full rounded-lg border border-[var(--kt-border)] bg-white px-4 py-3 text-sm text-[var(--kt-brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]";
const uiDate=(s:string)=>new Date(s).toISOString().slice(0,16);
export function HomeBannerEditor({state,actorId}:{state:State;actorId:string}) {
 const router=useRouter();const [saving,setSaving]=useState(false);const [notice,setNotice]=useState("");
 const preview=state.draft??state.active;
 async function mutate(action:"DRAFT"|"APPROVE"|"DISABLE",input:Record<string,unknown>){
  if(saving)return;setSaving(true);setNotice("");
  try{const response=await fetch("/api/admin/super-admin/home-banner",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data:{...input,expectedVersion:state.version}})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Banner update rejected.");setNotice(action==="DRAFT"?"Draft saved. A different Super Admin must approve before it is displayed.":action==="APPROVE"?"Banner approved. It will display only during its scheduled window.":"Banner disabled. No banner will display to customers.");router.refresh();}
  catch(error){setNotice(error instanceof Error?error.message:"Unable to save changes.");}finally{setSaving(false);}
 }
 const control=(key:"title"|"description"|"imageUrl"|"altText"|"href"|"startsAt"|"endsAt",label:string,type="text")=><label className={`grid gap-2 text-sm font-medium ${key==="description"||key==="imageUrl"||key==="altText"?"sm:col-span-2":""}`}>{label}<input className={inputClass} name={key} type={type} required maxLength={key==="description"?250:undefined} defaultValue={key==="startsAt"||key==="endsAt"?preview?uiDate(preview[key]):"":preview?.[key]??""}/></label>;
 return <div className="space-y-7">
  <header className="grid gap-px overflow-hidden rounded-xl border border-[var(--kt-border)] bg-[var(--kt-border)] sm:grid-cols-3">{[
   ["Live publication",state.active?"Approved":"Inactive"],["Awaiting review",state.draft?"Draft prepared":"No draft"],["Settings revision",String(state.version)],
  ].map(([title,value])=><div key={title} className="bg-white p-6"><p className="text-sm text-[var(--kt-text-soft)]">{title}</p><p className="mt-3 text-xl font-semibold text-[var(--kt-brand-navy)]">{value}</p></div>)}</header>
  <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
   <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const values=Object.fromEntries(f);void mutate("DRAFT",{...values,startsAt:new Date(`${String(values.startsAt)}Z`).toISOString(),endsAt:new Date(`${String(values.endsAt)}Z`).toISOString()});}} className="grid gap-5 rounded-xl border border-[var(--kt-border)] bg-white p-6 sm:grid-cols-2">
    <div className="sm:col-span-2"><h2 className="text-lg font-semibold text-[var(--kt-brand-navy)]">Editorial banner draft</h2><p className="mt-2 text-sm text-[var(--kt-text-soft)]">Only images from the configured KT Couriers Cloudinary account are accepted. Links must stay within the KT Couriers website.</p></div>
    {control("title","Headline")}{control("href","Destination (for example /shop)")}{control("description","Description")}{control("imageUrl","Approved Cloudinary image URL")}{control("altText","Accessible image description")}{control("startsAt","Start (UTC)","datetime-local")}{control("endsAt","End (UTC)","datetime-local")}
    <div className="sm:col-span-2"><button className="min-h-12 rounded-full bg-[var(--kt-brand-navy)] px-6 text-sm font-semibold text-white disabled:opacity-50" disabled={saving}>Save banner draft</button></div>
   </form>
   <aside className="space-y-5 rounded-xl border border-[var(--kt-border)] bg-white p-6"><h2 className="text-lg font-semibold text-[var(--kt-brand-navy)]">Publication and review</h2>
    {preview?<div className="overflow-hidden rounded-lg border border-[var(--kt-border)]"><div className="relative aspect-[16/9] bg-[var(--kt-surface-muted)]" style={{backgroundImage:`url(${preview.imageUrl})`,backgroundSize:"cover",backgroundPosition:"center"}} role="img" aria-label={preview.altText}/><div className="space-y-2 p-4"><strong className="text-[var(--kt-brand-navy)]">{preview.title}</strong><p className="text-sm text-[var(--kt-text-soft)]">{preview.description}</p><p className="text-xs">Target: {preview.href}</p></div></div>:<p className="rounded-lg border border-dashed border-[var(--kt-border)] p-5 text-sm text-[var(--kt-text-soft)]">No banner draft is available for preview.</p>}
    {state.draft&&<div className="space-y-2"><p className="text-sm text-[var(--kt-text-soft)]">Created by a different Super Admin? Verify the image, copy, destination and scheduled dates before approval.</p><button type="button" disabled={saving||state.draft.createdByUserId===actorId} onClick={()=>void mutate("APPROVE",{})} className="min-h-12 w-full rounded-full bg-[var(--kt-brand-navy)] px-5 text-sm font-semibold text-white disabled:opacity-50">Approve scheduled banner</button></div>}
    {state.active&&<button type="button" disabled={saving} onClick={()=>void mutate("DISABLE",{})} className="min-h-12 w-full rounded-full border border-[var(--kt-border)] text-sm font-semibold text-[var(--kt-brand-navy)] disabled:opacity-50">Disable live banner immediately</button>}
    {notice&&<p role="status" className="rounded-lg bg-[var(--kt-surface-muted)] p-4 text-sm">{notice}</p>}
    <p className="text-xs leading-5 text-[var(--kt-text-soft)]">Commercial advertising placements and paid campaigns remain under separate finance and marketing approval; publishing an editorial banner does not enable paid advertising.</p>
   </aside>
  </section>
 </div>;
}
