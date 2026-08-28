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
    desc: "Single or multi-stop delivery for packages, legal files, and parcels.",
    href: "/services/parcel",
    image: "/media/public/home/kt-home-09-package-detail.webp",
    detail: "Point-to-point courier handoff with verified custody transfer.",
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
    detail: "Careful produce transit from local markets to doorsteps.",
  },
  {
    id: "pharmacy",
    family: "Everyday Movement",
    title: "Pharmacy & Essentials",
    desc: "Discreet and timely delivery for wellness and pharmacy retail.",
    href: "/services/pharmacy",
    image: "/media/public/home/kt-home-06-wellness.webp",
    detail: "Verified recipient handoffs for essential wellness supplies.",
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
    desc: "Professional courier operations across designated regional hubs.",
    href: "/services/driver-network",
    image: "/media/public/home/kt-home-10-handoff.webp",
    detail: "Structured handoffs and coordination across active routes.",
  },
  // Planned Movement
  {
    id: "freight",
    family: "Planned Movement",
    title: "Freight & Heavy Cargo",
    desc: "Bulk shipments, palletized goods, and oversized cargo movement.",
    href: "/services/freight",
    image: "/media/public/home/kt-home-12-route-road.webp",
    detail: "Arterial road dispatch across verified logistics corridors.",
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
    desc: "Scheduled passenger movement and fixed-point shuttle coordination.",
    href: "/services/shuttle",
    image: "/media/public/home/kt-home-02-retail-local.webp",
    detail: "Planned group mobility across designated city points.",
  },
  // Quote Intelligence
  {
    id: "pricing",
    family: "Quote Intelligence",
    title: "Pricing & Variables",
    desc: "Understanding the pickup, dropoff, weight, and timing variables.",
    href: "/services/pricing",
    image: "/media/public/home/kt-home-01-world-market.webp",
    detail: "Dynamic calculation factors explained without hidden surprises.",
  },
] as const;

export type ServiceItem = (typeof allServices)[number];

interface ServicesAtlasMenuProps {
  open: boolean;
  onClose: () => void;
}

export function ServicesAtlasMenu({ open, onClose }: ServicesAtlasMenuProps) {
  const [activeItem, setActiveItem] = useState<ServiceItem>(allServices[0]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-label="Movement Atlas"
      aria-modal="true"
      className={styles.atlasOverlay}
      onClick={onClose}
      role="dialog"
    >
      <div
        className={styles.atlasDrawer}
        onClick={(e) => e.stopPropagation()}
        ref={menuRef}
      >
        <div className={styles.atlasIndexColumn}>
          <div className={styles.atlasHeaderRow}>
            <div className={styles.atlasHeaderTitles}>
              <span className={styles.atlasTitle}>Movement Atlas</span>
              <span className={styles.atlasSub}>11 specialized delivery routes</span>
            </div>
            <button
              aria-label="Close services atlas"
              className={styles.atlasCloseButton}
              onClick={onClose}
              type="button"
            >
              <KtIconClose size={20} />
            </button>
          </div>

          <div className={styles.atlasListLayout}>
            {allServices.map((item) => {
              const isSelected = activeItem.id === item.id;
              return (
                <Link
                  className={`${styles.atlasItemLink} ${isSelected ? styles.atlasItemLinkActive : ""}`}
                  href={item.href}
                  key={item.id}
                  onClick={onClose}
                  onFocus={() => setActiveItem(item)}
                  onMouseEnter={() => setActiveItem(item)}
                >
                  <div className={styles.atlasItemInfo}>
                    <span className={styles.atlasItemTitle}>{item.title}</span>
                    <span className={styles.atlasItemDesc}>{item.desc}</span>
                  </div>
                  <span className={styles.atlasItemArrow}>
                    <KtIconArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.atlasPreviewColumn}>
          <div className={styles.atlasPreviewCard}>
            <div className={styles.atlasPreviewMediaWrap}>
              <Image
                alt={activeItem.title}
                fill
                sizes="380px"
                src={activeItem.image}
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className={styles.atlasPreviewBody}>
              <span className={styles.atlasPreviewFamily}>{activeItem.family}</span>
              <h3 className={styles.atlasPreviewHeading}>{activeItem.title}</h3>
              <p className={styles.atlasPreviewDetail}>{activeItem.detail}</p>
              <Link
                className={styles.atlasPreviewAction}
                href={activeItem.href}
                onClick={onClose}
              >
                View route details <KtIconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
