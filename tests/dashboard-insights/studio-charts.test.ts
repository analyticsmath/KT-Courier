import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityBars, DistributionRing } from "@/components/protected-v2/studio/StudioCharts";
import { OperationsWorkbench } from "@/components/protected-v2/studio/OperationsWorkbench";

describe("Operational analytics presentation",()=>{
  it("preserves zero activity and exposes the exact series in a semantic data table",()=>{
    const html=renderToStaticMarkup(React.createElement(ActivityBars,{label:"Courier requests",buckets:[{start:"2026-10-01",end:"2026-10-02",label:"1 Oct",value:0},{start:"2026-10-02",end:"2026-10-03",label:"2 Oct",value:4}]}));
    expect(html).toContain('height:0%');expect(html).toContain('height:100%');
    expect(html).toContain('<th scope="row">1 Oct</th><td>0</td>');
    expect(html).toContain('<th scope="row">2 Oct</th><td>4</td>');
  });
  it("shows a truthful empty distribution without fabricated arcs",()=>{
    const html=renderToStaticMarkup(React.createElement(DistributionRing,{label:"Outcomes",items:[{label:"Delivered",value:0,color:"#1768ff"},{label:"Pending",value:0,color:"#17181d"}]}));
    expect(html).toContain('Total 0');expect(html.match(/<circle/g)).toHaveLength(1);
    expect(html).not.toContain('NaN');
  });
  it("selects an actual delivery and links directly to its record",()=>{
    const html=renderToStaticMarkup(React.createElement(OperationsWorkbench,{title:"Attention queue",description:"Review delivery",emptyTitle:"Queue clear",rows:[{id:"order-1",reference:"KT-001",origin:"Cape Town",destination:"Bellville",status:"Pending",date:"22 Oct",href:"/admin/orders/order-1"}]}));
    expect(html).toContain('aria-pressed="true"');expect(html).toContain('href="/admin/orders/order-1"');expect(html).toContain('Bellville');
  });
});
