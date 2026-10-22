import React from "react";
import Link from "next/link";
import { DashboardCanvas, DashboardPeriodControl } from "@/components/protected-v2/dashboard";
import { StoreFulfilmentQueue as FulfilmentQueue } from "./StoreFulfilmentQueue";
import type { StoreCourierOrderRecord } from "./StoreCourierOrderList";
import type { StoreFulfilmentQueue } from "@/lib/store-presentation/store-fulfilment-priority";
import { getStoreFulfilmentSummary } from "@/lib/store-presentation/store-fulfilment-priority";
import { storeAccountState } from "@/lib/store-presentation/store-status";
import type { CountInsight, DashboardPeriod } from "@/lib/dashboard-insights/types";
import { formatDateTime } from "@/lib/utils/formatters";
import { ActivityBars, DistributionRing } from "../studio/StudioCharts";
import { OperationsWorkbench } from "../studio/OperationsWorkbench";
import s from "../studio/workspaceStudio.module.css";
export interface StoreOverviewPageProps {
  storeName:string;storeStatus:string|null;queue:StoreFulfilmentQueue;recentCourierOrders:readonly StoreCourierOrderRecord[];
  pickupConfigured:boolean;payableBalance:string|null;insight?:CountInsight|null;courierInsight?:CountInsight|null;period?:DashboardPeriod;activity?:React.ReactNode;
}
export function StoreOverviewPage({storeName,storeStatus,queue,recentCourierOrders,pickupConfigured,payableBalance,insight,courierInsight,period="12_WEEKS",activity}:StoreOverviewPageProps){
  const summary=getStoreFulfilmentSummary(queue);const state=storeAccountState(storeStatus);
  const mix=[{label:"Preparation",value:summary.needsPreparation,color:"#1768ff"},{label:"Ready to collect",value:summary.readyForCollection,color:"#17181d"},{label:"Needs attention",value:summary.needsAttention,color:"#ff9b88"},{label:"Collection underway",value:queue.handoffInProgress.length,color:"#fff"}];
  return <DashboardCanvas>
    <header className={s.heading}><div><h1>{storeName}</h1><p>Your delivery activity, collections and daily fulfilment.</p></div><div className={s.actions}><DashboardPeriodControl period={period} href="/store" ariaLabel="Filter delivery activity period"/><Link className={s.button} href="/store/new-delivery">Create delivery ↗</Link></div></header>
    <section className={s.analytics} aria-label="Store analytics">
      <article className={s.panel}><div className={s.panelTitle}><h2>Courier delivery activity</h2><Link href="/store/orders">All requests ↗</Link></div>{courierInsight?<><div className={s.valueRow}><strong>{courierInsight.comparison?.current.toLocaleString("en-ZA")??"Unavailable"}</strong><span>{courierInsight.comparison?.changePercent!=null?`${courierInsight.comparison.changePercent>0?"+":""}${courierInsight.comparison.changePercent.toFixed(1)}% vs previous period`:"Store courier requests in selected period"}</span></div>{courierInsight.seriesUnavailable?<p className={s.notice}>Choose a shorter period to view the activity detail.</p>:<ActivityBars buckets={courierInsight.buckets} label="Store courier requests by creation date"/>}<p className={s.notice}>{courierInsight.periodLabel}</p></>:<p className={s.notice}>Courier activity unavailable.</p>}</article>
      <article className={`${s.panel} ${s.bluePanel}`}><div className={s.panelTitle}><h2>Marketplace pipeline</h2><span className={s.notice}>Live queue</span></div><DistributionRing items={mix} label="Active marketplace fulfilment stages"/></article>
      <article className={`${s.panel} ${s.yellowPanel}`}><div><h2>Confirmed earnings</h2><p className={s.balance}>{payableBalance!==null?`ZAR ${payableBalance}`:"Unavailable"}</p><p className={s.notice}>Current payable balance</p></div><Link className={s.quietButton} href="/store/earnings">Review earnings ↗</Link></article>
    </section>
    <OperationsWorkbench title="Recent courier requests" description="Select a delivery to see its destination and open the full record." emptyTitle="No courier requests yet. Create your first delivery to get started." rows={recentCourierOrders.map(row=>({id:row.id,reference:row.orderNumber,origin:"Store collection",destination:row.dropoffCity??"See delivery address",status:row.status.replaceAll("_"," ").toLowerCase(),date:formatDateTime(row.createdAt),href:`/store/orders/${row.id}`}))}>
      <a className={s.taskCard} href="#fulfilment-bench"><h3>Prepare orders ↗</h3><strong>{summary.needsPreparation}</strong><p>Accepted orders to get ready for collection</p></a>
      <a className={s.taskCard} href="#fulfilment-bench"><h3>Needs attention ↗</h3><strong>{summary.needsAttention}</strong><p>Review customer actions and order issues</p></a>
    </OperationsWorkbench>
    <section className={s.lowerGrid} aria-label="Fulfilment and store readiness">
      <div id="fulfilment-bench"><FulfilmentQueue queue={queue} limit={6}/></div>
      <article className={s.panel}><div className={s.panelTitle}><h2>Store readiness</h2><Link href="/store/profile">Manage store ↗</Link></div><ul className={s.regionList}><li><strong>Account</strong><span>{state.label}</span></li><li><strong>Collection point</strong><span>{pickupConfigured?"Pickup address saved":"Add a pickup address"}</span></li></ul><div className={s.panelTitle} style={{marginTop:25}}><h2>Marketplace activity</h2><span className={s.notice}>Selected period</span></div>{insight?<><div className={s.valueRow}><strong>{insight.comparison?.current.toLocaleString("en-ZA")??"Unavailable"}</strong><span>Marketplace orders received</span></div>{!insight.seriesUnavailable&&insight.buckets.some(b=>b.value>0)?<ActivityBars buckets={insight.buckets} label="Marketplace orders by creation date"/>:<p className={s.notice}>No marketplace orders in the selected period.</p>}</>:activity??<p className={s.notice}>Marketplace activity unavailable.</p>}</article>
    </section>
  </DashboardCanvas>;
}
