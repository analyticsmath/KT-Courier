import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import {
  getPublicServicePage,
  type PublicServiceId,
} from "@/lib/public-services/service-page-registry";
import { ServiceEditorial } from "@/components/public-v3/redesign/ServiceEditorial";

export const CANONICAL_QUOTE_PATH = "/quote";
export async function ServiceDetailPage({
  serviceId,
}: {
  serviceId: PublicServiceId;
}) {
  const service = getPublicServicePage(serviceId);
  return (
    <article
      data-kt-service-family={service.family}
      data-kt-service-page={service.slug}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
            { label: service.eyebrow, href: service.route },
          ]),
        }}
      />
      <ServiceEditorial service={service} />
    </article>
  );
}
