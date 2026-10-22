import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminCommandCentre } from "@/components/protected-v2/admin/AdminCommandCentre";
import type { AdminDesk } from "@/lib/dashboard-insights/admin-desk";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";

const restricted: AdminDesk = { insight:null, attention:null, dispatch:null, exceptions:[], exceptionCount:null, pendingStores:null, regions:null, ordersAllowed:false };

describe("Static operational workspace", () => {
  it("keeps restricted aggregates unavailable and omits unauthorized work links", () => {
    const html=renderToStaticMarkup(React.createElement(AdminCommandCentre,{desk:restricted,period:"7_DAYS"}));
    expect(html).toContain("Activity data restricted");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain('href="/admin/stores"');
    expect(html).not.toContain('href="/admin/orders"');
    expect(html).not.toContain('href="/admin/dispatch"');
    expect(html).not.toMatch(/<video|<em>|>01</);
  });
  it("renders available zero values as zero without fabricating activity", () => {
    const html=renderToStaticMarkup(React.createElement(AdminCommandCentre,{desk:{...restricted,ordersAllowed:true,pendingStores:0,attention:[],exceptionCount:0,insight:{title:"Orders",definition:"Courier orders",periodLabel:"Test period",comparison:{current:0,previous:0,changePercent:null,direction:"unavailable"},buckets:[],seriesUnavailable:false}},period:"7_DAYS"}));
    expect(html).toContain("No orders recorded in this period.");
    expect(html).toContain('href="/admin/stores"');
    expect(html).toContain("Queue clear");
    expect(html).not.toContain("7+");
  });
  it("keeps long values in labeled semantic cells for compact layouts", () => {
    const html=renderToStaticMarkup(React.createElement(EditorialTable<{id:string;name:string}>,{caption:"Store directory",rows:[{id:"store-1",name:"A long business name"}],columns:[{id:"store",header:"Store",cell:row=>row.name},{id:"management",header:"Management",cell:()=>React.createElement("details",{},React.createElement("summary",{},"Manage store"),React.createElement("a",{href:"/admin/stores/store-1"},"Review application"))}]}));
    expect(html).toContain('<th');
    expect(html).toContain('scope="col"');
    expect(html).toContain('data-label="Management"');
    expect(html).toContain('<summary>Manage store</summary>');
  });
  it("disables motion in every protected subtree including overlays and utility controls",()=>{
    const css=readFileSync("app/protected-workspace.css","utf8");
    expect(css).toContain('[data-kt-protected-system] *::after');
    expect(css).toContain('animation:none!important');
    expect(css).toContain('transition:none!important');
    expect(css).toContain('scale:none!important');
    expect(css).not.toMatch(/:hover|@keyframes|gradient\(/);
    expect(readFileSync("components/protected-v2/dashboard/DashboardCanvas.tsx","utf8")).not.toContain('dashboard-premium.css');
  });
});
