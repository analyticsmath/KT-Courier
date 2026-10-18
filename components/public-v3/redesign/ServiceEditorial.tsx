"use client";
import Image from "next/image";
import Link from "next/link";
import { serviceMedia } from "@/lib/public-assets/service-media";
import {
  getPublicServicePage,
  serviceFaqs,
  type PublicServicePageDefinition,
} from "@/lib/public-services/service-page-registry";
import { EditorialMotion } from "./EditorialMotion";
import {
  ParcelPackingSection,
  QuotePlanningSection,
  DeliveryCoverageSection,
} from "../services/DeliveryPlanningSections";

export function ServiceEditorial({
  service,
}: {
  service: PublicServicePageDefinition;
}) {
  const hero = serviceMedia[service.heroMediaId];
  const second = serviceMedia[service.detailMediaIds[0] ?? service.heroMediaId];
  const parcel = service.id === "parcel";
  const freight = service.id === "freight" || service.id === "moving";
  const food = service.id === "food" || service.id === "grocery";
  const title = parcel ? "Send a parcel." : service.title;
  return (
    <EditorialMotion
      className={`kt-service-detail-new ${freight ? "kt-service-large" : ""} ${food ? "kt-service-source" : ""}`}
    >
      <section className="kt-detail-opening">
        <div>
          <Link href="/services" className="kt-text-link">
            ← All delivery services
          </Link>
          <h1 data-split-heading>{title}</h1>
          <div className="kt-detail-actions">
            <Link href={service.primaryAction.href} className="kt-pill">
              {service.primaryAction.label} <span aria-hidden="true">↗</span>
            </Link>
            {parcel ? (
              <Link href="/track" className="kt-text-link">
                Track a delivery ↗
              </Link>
            ) : service.secondaryAction ? (
              <Link
                href={service.secondaryAction.href}
                className="kt-text-link"
              >
                {service.secondaryAction.label} ↗
              </Link>
            ) : null}
          </div>
          <p>{service.summary}</p>
        </div>
        <div className="kt-detail-hero-image" data-media-aperture>
          <Image
            data-parallax
            src={parcel ? "/media/public/editorial/collection.webp" : hero.src}
            alt={
              parcel
                ? "A paper shopping bag being handed across a counter"
                : hero.alt
            }
            fill
            priority
            sizes="(max-width:760px) 100vw, 52vw"
          />
        </div>
      </section>
      {freight && (
        <div className="kt-detail-truck" aria-hidden="true">
          <Image
            data-lateral
            src="/media/public/protagonists/protagonist-truck-red-side-right.webp"
            width={1672}
            height={941}
            alt=""
            sizes="100vw"
          />
        </div>
      )}
      <section
        className="kt-detail-process"
        data-section-transition="sweep"
        data-process-sequence
      >
        <div className="kt-detail-process-photo">
          <Image
            data-parallax
            src={
              parcel ? "/media/public/home/kt-home-13-arrival.webp" : second.src
            }
            alt={
              parcel ? "A recipient accepting a parcel at her door" : second.alt
            }
            fill
            sizes="(max-width:760px) 100vw, 49vw"
          />
        </div>
        <div>
          <h2 data-split-heading>
            {parcel
              ? "A clear start.\nA considered handoff."
              : "Start with the details."}
          </h2>
          {service.process.map((step) => (
            <div className="kt-process-point" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </section>
      {parcel && <ParcelPackingSection />}
      {service.primaryActionIsQuote && (
        <QuotePlanningSection factors={service.pricingFactors} />
      )}
      <section className="kt-detail-preparation" data-section-transition="open">
        <div data-reveal>
          <h2 data-split-heading>
            {parcel ? "Ready to send?" : "Before it moves."}
          </h2>
          <Link href={service.primaryAction.href} className="kt-text-link">
            {service.primaryAction.label} ↗
          </Link>
        </div>
        <div className="kt-detail-guidance" data-card-sequence>
          <section>
            <h3>What to have ready</h3>
            <ul>
              {service.preparation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Is this the right service?</h3>
            <ul>
              {service.idealFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          {service.restrictions.length > 0 && (
            <section>
              <h3>Good to know</h3>
              {service.restrictions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </section>
          )}
        </div>
      </section>
      {service.primaryActionIsQuote && <DeliveryCoverageSection />}
      <section className="kt-detail-questions" data-section-transition="rise">
        <h2 data-split-heading>
          A little more
          <br />
          clarity.
        </h2>
        <div>
          {service.faqIds.map((id) => (
            <section key={id}>
              <h3>{serviceFaqs[id].question}</h3>
              <p>{serviceFaqs[id].answer}</p>
            </section>
          ))}
        </div>
      </section>
      <nav className="kt-related-services" aria-label="Related services">
        {service.relatedServiceIds.map((id) => {
          const related = getPublicServicePage(id);
          return (
            <Link href={related.route} key={id}>
              {related.eyebrow}
              <span aria-hidden="true">↗</span>
            </Link>
          );
        })}
      </nav>
    </EditorialMotion>
  );
}
