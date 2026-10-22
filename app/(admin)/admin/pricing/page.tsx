import type { Metadata } from "next";
import { PricingRulesManager } from "@/components/admin/PricingRulesManager";
import { PersonalizedRatesManager } from "@/components/admin/PersonalizedRatesManager";
import { prisma } from "@/lib/db/prisma";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { getAllPricingRules } from "@/lib/services/pricing.service";
import { formatDateTime } from "@/lib/utils/formatters";
import { limitPricingToStore } from "@/lib/pricing/store-specific-admin-scope";

export const metadata: Metadata = { title: "Pricing rules" };
export default async function AdminPricingPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.PRICING_READ);
  const [rules, regions, canManage] = await Promise.all([getAllPricingRules(), listDeliveryRegions(true), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PRICING_MANAGE })]);
  const { storeId: requestedStoreId } = await searchParams;
  const selectedStoreId = typeof requestedStoreId === "string" && requestedStoreId.length <= 128 ? requestedStoreId : undefined;
  const [negotiated,customerAccounts,stores,selectedStore] = canManage ? await Promise.all([
    prisma.personalizedDeliveryRate.findMany({where:selectedStoreId ? {ownerType:"STORE",ownerId:selectedStoreId} : undefined,orderBy:{createdAt:"desc"},take:150}),
    prisma.user.findMany({where:{status:"ACTIVE",role:"CUSTOMER"},take:200,orderBy:{createdAt:"desc"},select:{id:true,name:true,email:true}}),
    prisma.store.findMany({where:{status:"ACTIVE"},take:200,orderBy:{createdAt:"desc"},select:{id:true,name:true}}),
    selectedStoreId ? prisma.store.findFirst({where:{id:selectedStoreId,status:"ACTIVE"},select:{id:true,name:true,status:true}}) : Promise.resolve(null),
  ]) : [[],[],[],null];
  const ownerOptions=[
    ...customerAccounts.map(c=>({type:"CUSTOMER",id:c.id,label:`Customer: ${c.name || c.email}`})),
    ...stores.map(s=>({type:"STORE",id:s.id,label:`Store: ${s.name}`})),
  ];
  const scoped = limitPricingToStore(selectedStoreId, selectedStore, ownerOptions, negotiated);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Pricing" title="Pricing rules" description="Rule applicability, effective dates, decimals, conflict detection, and revisions remain server-authoritative. This page does not calculate quotes." /><OperationalPanel title="Rule directory" description={canManage ? "Existing canonical pricing controls are available below." : "Read-only pricing access. Edit and activation controls are omitted without the management permission."}><EditorialTable caption="Pricing rule directory" mobileMode="stack" rows={rules} columns={[
    { id: "name", header: "Rule", priority: "primary", cell: (rule) => <div><strong>{rule.name}</strong><small>{rule.deliveryType?.replaceAll("_", " ") ?? "All services"}</small></div> },
    { id: "state", header: "State", priority: "primary", cell: (rule) => <ProtectedStatus label={rule.active ? "Active" : "Inactive"} tone={rule.active ? "success" : "neutral"} /> },
    { id: "region", header: "Region scope", priority: "secondary", cell: (rule) => regions.find((region) => region.id === rule.regionId)?.name ?? "Global fallback" },
    { id: "effective", header: "Effective period", priority: "optional", cell: (rule) => `${rule.effectiveFrom ? formatDateTime(rule.effectiveFrom) : "Now"} — ${rule.effectiveTo ? formatDateTime(rule.effectiveTo) : "No end"}` },
    { id: "revision", header: "Revision", priority: "secondary", cell: (rule) => rule.revision },
  ]} /></OperationalPanel>{canManage ? <OperationalPanel title="Personalized customer and store delivery rates" description="Bespoke account-specific tariffs; scope to a delivery service and parcel size. Draft, activate or deactivate with an audit reason.">
      <PersonalizedRatesManager
        owners={scoped.owners}
        rates={scoped.rates.map(r=>({
          id:r.id,ownerType:r.ownerType,ownerId:r.ownerId,serviceKey:r.serviceKey,
          parcelSize:r.parcelSize,versionNumber:r.versionNumber,status:r.status,
          baseFee:r.baseFee.toFixed(2),perKmRate:r.perKmRate.toFixed(4),
          minimumCharge:r.minimumCharge?.toFixed(2)??null,
          effectiveFrom:r.effectiveFrom.toISOString(),effectiveTo:r.effectiveTo?.toISOString()??null,
        }))}
      />
    </OperationalPanel> : null}{canManage ? <OperationalPanel title="Pricing rule controls" description="The existing form preserves currency, precision, conflict, effective-date, revision, and audit behavior."><PricingRulesManager rules={rules} regions={regions.map((region) => ({ id: region.id, name: region.name }))} /></OperationalPanel> : null}</ProtectedPageFrame>;
}
