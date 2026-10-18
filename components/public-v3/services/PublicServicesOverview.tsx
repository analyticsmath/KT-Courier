"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ktMediaV3, type KTMediaV3Asset } from "../media/kt-media-v3";
import styles from "./services-editorial.module.css";

type Service = { id:string; title:string; headline:string; summary:string; href:string; asset:KTMediaV3Asset };
const SERVICES: Service[] = [
 { id:"parcel",title:"Parcels & documents",headline:"From pickup to doorstep.",summary:"Arrange the movement of everyday parcels and important documents.",href:"/services/parcel",asset:ktMediaV3.pages.services.overview.parcel },
 { id:"ecommerce",title:"E-commerce",headline:"From checkout to delivery.",summary:"Delivery that connects local online purchases with their destinations.",href:"/services/ecommerce",asset:ktMediaV3.pages.services.overview.ecommerce },
 { id:"food",title:"Food delivery",headline:"Fresh from the source.",summary:"Connect local kitchens and food producers with customers.",href:"/services/food",asset:ktMediaV3.pages.services.overview.food },
 { id:"grocery",title:"Groceries",headline:"The everyday essentials.",summary:"Move fresh produce and household staples from local shops.",href:"/services/grocery",asset:ktMediaV3.pages.services.overview.grocery },
 { id:"pharmacy",title:"Pharmacy",headline:"Handled with attention.",summary:"Arrange pharmacy-related collections and deliveries.",href:"/services/pharmacy",asset:ktMediaV3.pages.services.overview.pharmacy },
 { id:"moving",title:"Moving",headline:"More than a parcel.",summary:"Coordinated transport for larger household and commercial loads.",href:"/services/moving",asset:ktMediaV3.pages.services.overview.moving },
 { id:"freight",title:"Freight",headline:"Scale changes. Care remains.",summary:"Discover coordinated freight and heavy-load transport services.",href:"/services/freight",asset:ktMediaV3.pages.services.overview.freight },
 { id:"shuttle",title:"Shuttle transport",headline:"Planned journeys.",summary:"Scheduled transport between available commercial points.",href:"/services/shuttle",asset:ktMediaV3.pages.services.overview.shuttle },
 { id:"business",title:"Business delivery",headline:"Keep your work moving.",summary:"Delivery management for businesses with repeat requirements.",href:"/services/business",asset:ktMediaV3.pages.services.overview.business },
 { id:"driver-network",title:"Driver network",headline:"The people behind the move.",summary:"Discover the people and vehicles serving the KT network.",href:"/services/driver-network",asset:ktMediaV3.pages.services.overview.driverNetwork },
 { id:"pricing",title:"Delivery pricing",headline:"Know what shapes the quote.",summary:"Understand how dimensions, distance and the service influence price.",href:"/services/pricing",asset:ktMediaV3.pages.services.overview.pricing }
];

export function PublicServicesOverview() {
 const [active,setActive]=useState(0);
 const hero=useRef<HTMLElement>(null);
 const actor=useRef<HTMLDivElement>(null);
 const root=useRef<HTMLElement>(null);
 const current=SERVICES[active];
 useEffect(()=>{
  if(!hero.current||!actor.current||!root.current||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  gsap.registerPlugin(ScrollTrigger);
  const ctx=gsap.context(()=>{
    gsap.fromTo(actor.current,{xPercent:-10,rotate:-.8},{xPercent:0,rotate:0,ease:"none",scrollTrigger:{trigger:hero.current,start:"top 82%",end:"bottom 20%",scrub:.7,invalidateOnRefresh:true}});
    const rows=gsap.utils.toArray<HTMLElement>("[data-service-editorial-row]");
    rows.forEach(row=>gsap.fromTo(row,{y:28,opacity:.75},{y:0,opacity:1,duration:.75,ease:"power3.out",scrollTrigger:{trigger:row,start:"top 88%",toggleActions:"play none none reverse"}}));
  },root);
  return ()=>ctx.revert();
 },[]);
 return <article ref={root} className={styles.root}>
  <section ref={hero} className={styles.hero} aria-labelledby="kt-services-heading">
    <div className={styles.road} aria-hidden="true"><Image src="/media/public/home/kt-home-11-route-city.webp" alt="" fill sizes="100vw"/></div>
    <div className={styles.heroContent}>
      <h1 id="kt-services-heading" className={styles.heroTitle}>Every move<span>matters.</span></h1>
      <p className={styles.heroLead}>A parcel across town. A larger load across the region. Find the right way to move what comes next.</p>
      <div className={styles.heroActions}><Link href="/quote">Get a quote ↗</Link><Link href="/track">Track delivery ↗</Link></div>
    </div>
    <div className={styles.truck} ref={actor} aria-hidden="true">
      <Image src="/media/public/protagonists/protagonist-van-side-right.webp" alt="" width={1448} height={1086} sizes="(max-width:600px) 110vw, 65vw" priority />
    </div>
  </section>
  <section className={styles.explorer} aria-labelledby="explore-services-heading">
   <div className={styles.explorerTop}><h2 id="explore-services-heading">The way forward.</h2><p>Choose the movement that fits. Each service has its own requirements, route and handoff.</p></div>
   <div className={styles.layout}>
    <div className={styles.index}>
      {SERVICES.map((service,index)=><Link href={service.href} key={service.id} data-service-editorial-row className={`${styles.row} ${active===index?styles.rowActive:""}`} onPointerEnter={()=>setActive(index)} onFocus={()=>setActive(index)}>
       <span className={styles.number} aria-hidden="true">{String(index+1).padStart(2,"0")}</span>
       <span className={styles.rowText}><span className={styles.rowName}>{service.title}</span><span className={styles.rowDetail}>{service.headline}</span></span>
       <span className={styles.arrow} aria-hidden="true">↗</span>
       <span className={styles.mobilePreview}><Image src={service.asset.src} alt={service.asset.alt} fill sizes="(max-width:950px) 75vw, 1px" style={{objectPosition:`${service.asset.focalPoint[0]*100}% ${service.asset.focalPoint[1]*100}%`}}/></span>
      </Link>)}
    </div>
    <aside className={styles.stage} aria-live="polite">
      <div className={styles.media}><Image key={current.asset.src} src={current.asset.src} alt={current.asset.alt} fill sizes="(max-width:950px) 1px, 40vw" style={{objectPosition:`${current.asset.focalPoint[0]*100}% ${current.asset.focalPoint[1]*100}%`}}/></div>
      <div className={styles.copy}><h3>{current.headline}</h3><p>{current.summary}</p><Link href={current.href}>Explore {current.title.toLowerCase()} ↗</Link></div>
    </aside>
   </div>
  </section>
 </article>;
}
