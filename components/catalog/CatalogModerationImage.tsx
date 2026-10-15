import { isCatalogMediaMimeType } from "@/lib/catalog/media/catalog-media-policy";

export function CatalogModerationImage({ asset, alt }: {
  asset: { id: string; status: string; mimeType: string | null; privacyInspectionPassed: boolean; purpose?: string };
  alt: string;
}) {
  if (asset.purpose === "COMPLIANCE_DOCUMENT" || !["READY", "QUARANTINED"].includes(asset.status) || !asset.mimeType || !isCatalogMediaMimeType(asset.mimeType) || !asset.privacyInspectionPassed) {
    return <p className="text-sm text-[var(--eo-text-muted)]">Image preview is unavailable until content validation is complete.</p>;
  }
  const path = `/api/admin/catalog/media/${encodeURIComponent(asset.id)}/content`;
  return <figure className="my-3 space-y-2">
    {/* eslint-disable-next-line @next/next/no-img-element -- Private review uses the authenticated, uncached original. */}
    <img src={path} alt={alt} loading="lazy" className="max-h-96 max-w-full rounded-lg border border-[var(--eo-line-soft)] object-contain" />
    <figcaption><a href={`${path}?download=1`} className="text-sm font-semibold underline">Download image for inspection</a></figcaption>
  </figure>;
}
