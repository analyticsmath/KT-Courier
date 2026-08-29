"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

export const allServices = [
  {
    id: "parcel",
    family: "Everyday Movement",
    title: "Parcel",
    desc: "Single and multi-stop package delivery across active city routes.",
    href: "/services/parcel",
    image: "/media/public/home/kt-home-09-package-detail.webp",
    detail: "Point-to-point courier handoff for parcels and critical shipments.",
  },
  {
    id: "food",
    family: "Everyday Movement",
    title: "Food",
    desc: "Dedicated local delivery for kitchen orders and prepared meals.",
    href: "/services/food",
    image: "/media/public/home/kt-home-03-food-local.webp",
    detail: "Direct connection between kitchen prep and customer arrival.",
  },
  {
    id: "grocery",
    family: "Everyday Movement",
    title: "Grocery",
    desc: "Daily market produce, essential staples, and neighborhood groceries.",
    href: "/services/grocery",
    image: "/media/public/home/kt-home-04-grocery.webp",
    detail: "Produce transit from local markets to residential doorsteps.",
  },
  {
    id: "pharmacy",
    family: "Everyday Movement",
    title: "Pharmacy",
    desc: "Direct delivery for wellness and healthcare retail essentials.",
    href: "/services/pharmacy",
    image: "/media/public/home/kt-home-06-wellness.webp",
    detail: "Scheduled and on-demand handoffs for essential wellness supplies.",
  },
  {
    id: "ecommerce",
    family: "Business Flow",
    title: "Ecommerce",
    desc: "Marketplace merchant order fulfilment and customer delivery.",
    href: "/services/ecommerce",
    image: "/media/public/home/kt-home-05-fashion.webp",
    detail: "Direct connection from catalog orders to customer destinations.",
  },
  {
    id: "business",
    family: "Business Flow",
    title: "Business",
    desc: "Scheduled corporate dispatches, contract routing, and accounts.",
    href: "/services/business",
    image: "/media/public/home/kt-home-08-merchant-prepare.webp",
    detail: "Account-based delivery management for commercial senders.",
  },
  {
    id: "driver-network",
    family: "Business Flow",
    title: "Driver Network",
    desc: "Courier fleet operations across designated regional transit hubs.",
    href: "/services/driver-network",
    image: "/media/public/home/kt-home-10-handoff.webp",
    detail: "Structured handoffs and coordination across active routes.",
  },
  {
    id: "freight",
    family: "Planned Movement",
    title: "Freight",
    desc: "Heavy shipments, palletized freight, and corridor transport.",
    href: "/services/freight",
    image: "/media/public/home/kt-home-12-route-road.webp",
    detail: "Arterial road transport across active regional delivery corridors.",
  },
  {
    id: "moving",
    family: "Planned Movement",
    title: "Moving",
    desc: "Planned residential and commercial property item relocation.",
    href: "/services/moving",
    image: "/media/public/home/kt-home-11-route-city.webp",
    detail: "Scheduled space planning and coordinated relocation transit.",
  },
  {
    id: "shuttle",
    family: "Planned Movement",
    title: "Shuttle",
    desc: "Scheduled passenger movement and group shuttle coordination.",
    href: "/services/shuttle",
    image: "/media/public/home/kt-home-02-retail-local.webp",
    detail: "Planned group mobility across designated points.",
  },
  {
    id: "pricing",
    family: "Quote Intelligence",
    title: "Pricing",
    desc: "Transparent calculation factors: distance, size, and scheduling.",
    href: "/services/pricing",
    image: "/media/public/home/kt-home-01-world-market.webp",
    detail: "Delivery quote breakdown with transparent variable explanations.",
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
    firstLinkRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-label="Service Index"
      className={styles.serviceIndexBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.serviceIndexPlane}>
        <div className={styles.serviceIndexInner}>
          {/* Left Service Index Column */}
          <div className={styles.serviceIndexLeft}>
            <ul className={styles.serviceIndexList} role="tablist">
              {allServices.map((service, idx) => {
                const isActive = idx === activeIdx;

                return (
                  <li key={service.id}>
                    <Link
                      aria-selected={isActive}
                      className={`${styles.serviceIndexLink} ${
                        isActive ? styles.serviceIndexLinkActive : ""
                      }`}
                      href={service.href}
                      onClick={onClose}
                      onFocus={() => setActiveIdx(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      ref={idx === 0 ? firstLinkRef : undefined}
                      role="tab"
                    >
                      <span>{service.title}</span>
                      {isActive && (
                        <span className={styles.serviceIndexDetailActive}>
                          {service.desc}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right Active Service World Media */}
          <div className={styles.serviceIndexRight}>
            <div className={styles.serviceMediaStage}>
              <Image
                alt={activeService.title}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 55vw"
                src={activeService.image}
                style={{ objectFit: "cover" }}
              />
            </div>

            <div className={styles.servicePlaneFooterBar}>
              <p className={styles.servicePlaneDesc}>{activeService.detail}</p>
              <Link
                className={styles.servicePlaneDirectAction}
                href={activeService.href}
                onClick={onClose}
              >
                <span>Open {activeService.title}</span>
                <KtIconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
