"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { publicServicePages } from "@/lib/public-services/service-page-registry";
import { serviceMedia } from "@/lib/public-assets/service-media";
import { EditorialMotion } from "../redesign/EditorialMotion";
import {
  ServiceStartingPoints,
  QuotePlanningSection,
  DeliveryCoverageSection,
} from "./DeliveryPlanningSections";

export function PublicServicesOverview() {
  const [active, setActive] = useState(0);
  const requested = useRef(0);
  const select = useCallback((index: number) => {
    requested.current = index;
    const image = new window.Image();
    image.src = serviceMedia[publicServicePages[index].heroMediaId].src;
    void image
      .decode()
      .then(() => {
        if (requested.current === index) setActive(index);
      })
      .catch(() => {
        /* Retain the last usable preview when media cannot load. */
      });
  }, []);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            select(Number((entry.target as HTMLElement).dataset.serviceIndex));
      },
      { rootMargin: "-25% 0px -55% 0px" },
    );
    list.current
      ?.querySelectorAll("[data-service-index]")
      .forEach((row) => observer.observe(row));
    return () => {
      observer.disconnect();
      requested.current = -1;
    };
  }, [select]);
  const selected = publicServicePages[active] ?? publicServicePages[0];
  const asset = serviceMedia[selected.heroMediaId];
  return (
    <EditorialMotion className="kt-services-new">
      <section className="kt-services-opening">
        <h1 data-split-heading>
          Find the
          <br />
          right delivery.
        </h1>
        <div className="kt-services-intro">
          <p>
            From a single parcel to a larger movement. Start with what you need
            to send.
          </p>
          <Link href="/quote" className="kt-pill">
            Get a delivery quote <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="kt-services-hero-photo" data-media-aperture>
          <Image
            data-parallax
            src="/media/public/editorial/collection.webp"
            alt="A paper shopping bag passing from a shop to a customer"
            fill
            sizes="(max-width:760px) 100vw, 68vw"
            priority
          />
        </div>
      </section>
      <ServiceStartingPoints />
      <section
        className="kt-service-atlas"
        data-section-transition="sweep"
        aria-label="Choose a delivery service"
      >
        <div ref={list} className="kt-atlas-index">
          {publicServicePages.map((service, index) => (
            <Link
              key={service.id}
              href={service.route}
              data-service-index={index}
              onPointerEnter={() => select(index)}
              onFocus={() => select(index)}
              className={active === index ? "is-active" : ""}
            >
              <h2>
                {service.id === "parcel"
                  ? "Parcels & documents"
                  : service.eyebrow}
              </h2>
              <p>{service.summary}</p>
              <span aria-hidden="true">↗</span>
              <div className="kt-atlas-mobile-image">
                <Image
                  src={serviceMedia[service.heroMediaId].src}
                  alt={serviceMedia[service.heroMediaId].alt}
                  fill
                  sizes="(max-width:760px) 90vw, 1px"
                />
              </div>
            </Link>
          ))}
        </div>
        <aside className="kt-atlas-media" aria-label="Selected service preview">
          <div className="kt-atlas-image" key={asset.src}>
            <Image
              unoptimized
              src={asset.src}
              alt={asset.alt}
              fill
              sizes="42vw"
            />
            <span>
              {selected.id === "parcel"
                ? "Parcels & documents"
                : selected.eyebrow}
            </span>
          </div>
        </aside>
      </section>
      <QuotePlanningSection />
      <DeliveryCoverageSection />
    </EditorialMotion>
  );
}
