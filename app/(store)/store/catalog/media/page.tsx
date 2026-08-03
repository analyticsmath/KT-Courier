import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation, StorefrontAvailability } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreCatalogMediaForPage } from "@/lib/services/catalog-media-page.service";

export default async function StoreCatalogMediaPage() {
  const { store } = await getCurrentStoreForCatalogPage();
  const assets = await listStoreCatalogMediaForPage(store.id);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog" title="Catalog media" description="Store-owned media evidence. Upload and association controls stay inside the existing canonical product workflow." />
    <StoreCatalogNavigation />
    {assets.length ? <EditorialTable caption="Store catalog media" mobileMode="stack" rows={assets.map((asset) => ({ id: asset.id, asset }))} columns={[
      { id: "reference", header: "Media", priority: "primary", cell: ({ asset }) => <span className="font-mono text-xs">{asset.publicReference}</span> },
      { id: "state", header: "State", priority: "secondary", cell: ({ asset }) => <ProtectedStatus label={asset.status.replaceAll("_", " ")} /> },
      { id: "content", header: "Inspected content", priority: "secondary", cell: ({ asset }) => <span>{asset.mimeType ?? "Pending inspection"}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}</span> },
      { id: "associations", header: "Associations", align: "end", priority: "optional", cell: ({ asset }) => asset.productMedia.length },
    ]} /> : <ProtectedState kind="empty" title="No catalog media evidence exists" description="Media records appear only after the existing product-media workflow records a store-owned asset." />}
    <StorefrontAvailability />
  </ProtectedPageFrame>;
}
