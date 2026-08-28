"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { KtIconArrowRight, KtIconClose } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

export const serviceItems = [
  {
    id: "parcel",
    title: "Parcels & Documents",
    desc: "Single or multi-stop delivery for packages, legal documents and parcels.",
    href: "/services/parcel",
    image: "/media/public/home/kt-home-09-package-detail.webp",
    detail: "Same-day and scheduled delivery with verified physical custody transfer.",
  },
  {
    id: "business",
    title: "Business & Store Logistics",
    desc: "Integrated merchant dispatch, scheduled batch orders and store fulfillment.",
    href: "/services/business",
    image: "/media/public/home/kt-home-08-merchant-prepare.webp",
    detail: "Dedicated accounts, scheduled recurring dispatches and merchant management.",
  },
  {
    id: "food",
    title: "Food & Grocery",
    desc: "Careful local delivery for restaurant menus, market produce and perishable goods.",
    href: "/services/food",
    image: "/media/public/home/kt-home-03-food-local.webp",
    detail: "Rapid regional point-to-point courier service connecting kitchens and customers.",
  },
  {
    id: "freight",
    title: "Freight & Heavy Moving",
    desc: "Larger bulk freight, oversized items and regional cargo movement.",
    href: "/services/freight",
    image: "/media/public/home/kt-home-12-route-road.webp",
    detail: "Vehicular route dispatch across South African transit routes and highways.",
  },
  {
    id: "drivers",
    title: "Driver Network",
    desc: "Join our network of verified professional couriers and drivers.",
    href: "/services/driver-network",
    image: "/media/public/home/kt-home-10-handoff.webp",
    detail: "Operate across designated city hubs with structured handoffs.",
  },
] as const;

type ServiceItem = (typeof serviceItems)[number];

interface ServicesAtlasMenuProps {
  open: boolean;
  onClose: () => void;
}

export function ServicesAtlasMenu({ open, onClose }: ServicesAtlasMenuProps) {
  const [activeItem, setActiveItem] = useState<ServiceItem>(serviceItems[0]);
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
    <div aria-label="Services Atlas" aria-modal="true" className={styles.atlasOverlay} onClick={onClose} role="dialog">
      <div className={styles.atlasDrawer} onClick={(e) => e.stopPropagation()} ref={menuRef}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Services Atlas</h2>
            <button
              aria-label="Close services menu"
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kt-carbon)", padding: 4 }}
              type="button"
            >
              <KtIconClose size={20} />
            </button>
          </div>
          <ul className={styles.atlasList} role="list">
            {serviceItems.map((item) => {
              const isSelected = activeItem.id === item.id;
              return (
                <li key={item.id}>
                  <Link
                    className={`${styles.atlasCard} ${isSelected ? styles.atlasCardActive : ""}`}
                    href={item.href}
                    onClick={onClose}
                    onFocus={() => setActiveItem(item)}
                    onMouseEnter={() => setActiveItem(item)}
                  >
                    <span className={styles.atlasCardTitle}>
                      {item.title}
                      <KtIconArrowRight size={16} />
                    </span>
                    <span className={styles.atlasCardDesc}>{item.desc}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.atlasPreview}>
          <div>
            <div className={styles.atlasPreviewImage}>
              <Image
                alt={activeItem.title}
                fill
                sizes="340px"
                src={activeItem.image}
                style={{ objectFit: "cover" }}
              />
            </div>
            <h3 className={styles.atlasPreviewTitle}>{activeItem.title}</h3>
            <p className={styles.atlasPreviewText}>{activeItem.detail}</p>
          </div>
          <Link
            className={styles.quoteButton}
            href={activeItem.href}
            onClick={onClose}
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            Explore service
          </Link>
        </div>
      </div>
    </div>
  );
}
