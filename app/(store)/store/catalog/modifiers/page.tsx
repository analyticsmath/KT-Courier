import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreModifierGroups } from "@/lib/services/catalog-modifier.service";

export default async function StoreCatalogModifiersPage() {
  const { store } = await getCurrentStoreForCatalogPage();
  const groups = await listStoreModifierGroups(store.id);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Catalog" title="Modifier groups" description="Reusable store option groups. Modifiers remain distinct from canonical variants." /><StoreCatalogNavigation />{groups.length ? <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => <OperationalPanel key={group.id} title={group.name} action={<ProtectedStatus label={group.status.replaceAll("_", " ")} />} padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">Select {group.minimumSelections}–{group.maximumSelections}{group.isRequired ? " · required" : ""}</p><ul className="mt-4 divide-y divide-[var(--eo-line-soft)]">{group.options.map((option) => <li className="flex items-center justify-between gap-3 py-3 text-sm" key={option.id}><span>{option.name}</span><span className="tabular-nums">ZAR {option.priceDelta.toFixed(2)}</span></li>)}</ul></OperationalPanel>)}</div> : <ProtectedState kind="empty" title="No modifier groups are available" description="Modifier groups appear only when the canonical catalog authority records them for this store." />}</ProtectedPageFrame>;
}
