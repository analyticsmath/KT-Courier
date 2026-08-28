"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { KtIconArrowRight, KtIconClose } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

export const allServices = [
  // Everyday Movement
  {
    id: "parcel",
    family: "Everyday Movement",
    title: "Parcels & Documents",
    desc: "Single or multi-stop delivery for packages, documents, and parcels.",
    href: "/services/parcel",
    image: "/media/public/home/kt-home-09-package-detail.webp",
    detail: "Point-to-point courier handoff for everyday items.",
  },
  {
    id: "food",
    family: "Everyday Movement",
    title: "Food & Kitchens",
    desc: "Dedicated local delivery for restaurant menus and prepared meals.",
    href: "/services/food",
    image: "/media/public/home/kt-home-03-food-local.webp",
    detail: "Direct connection between kitchen prep and customer arrival.",
  },
  {
    id: "grocery",
    family: "Everyday Movement",
    title: "Fresh Grocery",
    desc: "Daily market produce, essential staples, and neighborhood groceries.",
    href: "/services/grocery",
    image: "/media/public/home/kt-home-04-grocery.webp",
    detail: "Produce transit from local markets to doorsteps.",
  },
  {
    id: "pharmacy",
    family: "Everyday Movement",
    title: "Pharmacy & Essentials",
    desc: "Delivery for wellness and pharmacy retail.",
    href: "/services/pharmacy",
    image: "/media/public/home/kt-home-06-wellness.webp",
    detail: "Handoffs for essential wellness supplies.",
  },
  // Business Flow
  {
    id: "business",
    family: "Business Flow",
    title: "Business Logistics",
    desc: "Recurring merchant dispatches, scheduled routing, and store accounts.",
    href: "/services/business",
    image: "/media/public/home/kt-home-08-merchant-prepare.webp",
    detail: "Account-based delivery management for commercial senders.",
  },
  {
    id: "ecommerce",
    family: "Business Flow",
    title: "E-commerce Fulfilment",
    desc: "Marketplace seller order fulfilment and customer delivery.",
    href: "/services/ecommerce",
    image: "/media/public/home/kt-home-05-fashion.webp",
    detail: "Direct connection from online catalog to final destination.",
  },
  {
    id: "driver-network",
    family: "Business Flow",
    title: "Driver Network",
    desc: "Courier operations across designated regional hubs.",
    href: "/services/driver-network",
    image: "/media/public/home/kt-home-10-handoff.webp",
    detail: "Structured handoffs and coordination across active routes.",
  },
  // Planned Movement
  {
    id: "freight",
    family: "Planned Movement",
    title: "Freight & Large Cargo",
    desc: "Large shipments and freight movement.",
    href: "/services/freight",
    image: "/media/public/home/kt-home-12-route-road.webp",
    detail: "Arterial road dispatch across active delivery corridors.",
  },
  {
    id: "moving",
    family: "Planned Movement",
    title: "Moving & Relocation",
    desc: "Planned residential and commercial item relocation.",
    href: "/services/moving",
    image: "/media/public/home/kt-home-11-route-city.webp",
    detail: "Scheduled space planning and coordinated transport.",
  },
  {
    id: "shuttle",
    family: "Planned Movement",
    title: "Shuttle & Group Transit",
    desc: "Scheduled passenger movement and shuttle coordination.",
    href: "/services/shuttle",
    image: "/media/public/home/kt-home-02-retail-local.webp",
    detail: "Planned group mobility across designated points.",
  },
  // Quote Intelligence
  {
    id: "pricing",
    family: "Quote Intelligence",
    title: "Pricing & Variables",
    desc: "Understanding pickup, dropoff, weight, and timing variables.",
    href: "/services/pricing",
    image: "/media/public/home/kt-home-01-world-market.webp",
    detail: "Calculation factors explained clearly.",
  },
] as const;

export type ServiceItem = (typeof allServices)[number];

interface ServicesAtlasMenuProps {
  open: boolean;
  onClose: () => void;
}

export function ServicesAtlasMenu({ open, onClose }: ServicesAtlasMenuProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeService = allServices[activeIdx] || allServices[0];
  const menuRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Focus management and Escape key handling
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Focus first link on open
    firstLinkRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-label="Movement Atlas"
      className={styles.atlasMenuBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.atlasMenuContainer} ref={menuRef}>
        <div className={styles.atlasMenuHeader}>
          <div>
            <h2 className={styles.atlasMenuTitle}>Movement Atlas</h2>
            <p className={styles.atlasMenuSub}>
              11 service routes organized across everyday and planned logistics.
            </p>
          </div>
          <button
            aria-label="Close Movement Atlas"
            className={styles.atlasCloseButton}
            onClick={onClose}
            type="button"
          >
            <KtIconClose size={20} />
          </button>
        </div>

        <div className={styles.atlasMenuContent}>
          {/* Service Link Stream */}
          <nav aria-label="Atlas Services" className={styles.atlasNavStream}>
            <ul className={styles.atlasServiceList}>
              {allServices.map((service, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <li key={service.id}>
                    <Link
                      className={`${styles.atlasServiceLink} ${
                        isActive ? styles.atlasServiceLinkActive : ""
                      }`}
                      href={service.href}
                      onClick={onClose}
                      onFocus={() => setActiveIdx(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      ref={idx === 0 ? firstLinkRef : undefined}
                    >
                      <span className={styles.atlasServiceTitle}>{service.title}</span>
                      <span className={styles.atlasServiceDesc}>{service.desc}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Large Photographic Preview Stage */}
          <div aria-live="polite" className={styles.atlasPreviewStage}>
            <div className={styles.atlasPreviewMediaWrap}>
              <Image
                alt={activeService.title}
                fill
                priority
                sizes="500px"
                src={activeService.image}
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className={styles.atlasPreviewBody}>
              <h3 className={styles.atlasPreviewHeading}>{activeService.title}</h3>
              <p className={styles.atlasPreviewDetail}>{activeService.detail}</p>
              <Link
                className={styles.atlasPreviewAction}
                href={activeService.href}
                onClick={onClose}
              >
                <span>View Route</span>
                <KtIconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
