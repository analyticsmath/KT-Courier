import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";

export function PublicBreadcrumbScript({ items }: { items: readonly { label: string; href: string }[] }) {
  return <script dangerouslySetInnerHTML={{ __html: publicBreadcrumbJsonLd(items) }} type="application/ld+json" />;
}
