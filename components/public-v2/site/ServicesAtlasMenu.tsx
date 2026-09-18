"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";
import styles from "./public-shell.module.css";

export const allServices = [
  {
    id: "parcel",
    family: "Everyday Movement",
    title: "Parcel",
    desc: "Single and multi-stop package delivery across active city routes.",
    href: "/services/parcel",
    image: "/media/public/protagonists/protagonist-courier-hero-standing.webp",
    detail: "Point-to-point courier handoff for parcels and critical shipments.",
  },
  {
    id: "food",
    family: "Everyday Movement",
    title: "Food",
    desc: "Dedicated local delivery for kitchen orders and prepared meals.",
    href: "/services/food",
    image: "/media/public/derived/market-food-prepared-bowl-1920w.webp",
    detail: "Direct connection between kitchen prep and customer arrival.",
  },
  {
    id: "grocery",
    family: "Everyday Movement",
    title: "Grocery",
    desc: "Daily market produce, essential staples, and neighborhood groceries.",
    href: "/services/grocery",
    image: "/media/public/derived/market-produce-fresh-crates-1920w.webp",
    detail: "Produce transit from local markets to residential doorsteps.",
  },
  {
    id: "pharmacy",
    family: "Everyday Movement",
    title: "Pharmacy",
    desc: "Direct delivery for wellness and healthcare retail essentials.",
    href: "/services/pharmacy",
    image: "/media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-1920w.webp",
    detail: "Scheduled and on-demand handoffs for essential wellness supplies.",
  },
  {
    id: "ecommerce",
    family: "Business Flow",
    title: "Ecommerce",
    desc: "Marketplace merchant order fulfilment and customer delivery.",
    href: "/services/ecommerce",
    image: "/media/public/derived/market-craft-leather-bags-1920w.webp",
    detail: "Direct connection from catalog orders to customer destinations.",
  },
  {
    id: "business",
    family: "Business Flow",
    title: "Business",
    desc: "Scheduled corporate dispatches, contract routing, and accounts.",
    href: "/services/business",
    image: "/media/public/derived/documentary-r2-doc-03-pickup-1440w.webp",
    detail: "Account-based delivery management for commercial senders.",
  },
  {
    id: "driver-network",
    family: "Business Flow",
    title: "Driver Network",
    desc: "Courier fleet operations across designated regional transit hubs.",
    href: "/services/driver-network",
    image: "/media/public/protagonists/protagonist-van-sliding-door-open.webp",
    detail: "Structured handoffs and coordination across active routes.",
  },
  {
    id: "freight",
    family: "Planned Movement",
    title: "Freight",
    desc: "Heavy shipments, palletized freight, and corridor transport.",
    href: "/services/freight",
    image: "/media/public/protagonists/protagonist-truck-red-side-right.webp",
    detail: "Arterial road transport across active regional delivery corridors.",
  },
  {
    id: "moving",
    family: "Planned Movement",
    title: "Moving",
    desc: "Planned residential and commercial property item relocation.",
    href: "/services/moving",
    image: "/media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-1920w.webp",
    detail: "Scheduled space planning and coordinated relocation transit.",
  },
  {
    id: "shuttle",
    family: "Planned Movement",
    title: "Shuttle",
    desc: "Scheduled passenger movement and group shuttle coordination.",
    href: "/services/shuttle",
    image: "/media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-1920w.webp",
    detail: "Planned group mobility across designated points.",
  },
  {
    id: "pricing",
    family: "Quote Intelligence",
    title: "Pricing",
    desc: "Transparent calculation factors: distance, size, and scheduling.",
    href: "/services/pricing",
    image: "/media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-1920w.webp",
    detail: "Delivery quote breakdown with transparent variable explanations.",
  },
] as const;

export type ServiceItem = (typeof allServices)[number];

interface ServicesAtlasMenuProps {
  open: boolean;
  onClose: () => void;
}

export function ServicesAtlasMenu({ open, onClose }: ServicesAtlasMenuProps) {
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [activeIdx, setActiveIdx] = useState(0);
  const activeService = allServices[activeIdx] || allServices[0];
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((prev) => {
          const next = (prev + 1) % allServices.length;
          itemRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((prev) => {
          const next = (prev - 1 + allServices.length) % allServices.length;
          itemRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "Tab") {
        // Focus trap
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Focus the first item or active item
    itemRefs.current[activeIdx]?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [open, onClose, activeIdx]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      aria-label="Movement Atlas: Services Directory"
      aria-modal="true"
      className={styles.serviceIndexBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      {/* Route geometry curved container */}
      <div
        className={styles.serviceIndexPlane}
        style={{
          clipPath: prefersReducedMotion
            ? "none"
            : "polygon(0 0, calc(100% - 32px) 0, 100% 32px, 100% 100%, 0 100%)",
        }}
      >
        {/* KT route geometry top banner / curve header */}
        <div className="w-full flex items-center justify-between px-8 py-3 bg-[#0E1012] border-b border-[#D9DEE2]/15">
          <div className="flex items-center gap-3">
            <svg
              className="w-12 h-4 text-[#347CFB]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 48 16"
              aria-hidden="true"
            >
              <path d="M2 14 C16 14, 20 2, 46 2" />
            </svg>
            <span className="text-[11px] font-mono tracking-widest text-[#F3F1EA] uppercase font-semibold">
              KT MOVEMENT ATLAS · 11 CORRIDORS
            </span>
          </div>
          <button
            aria-label="Close Atlas"
            onClick={onClose}
            className="px-3 py-1 bg-transparent border border-[#D9DEE2]/30 hover:border-[#347CFB] text-[#F3F1EA] text-[11px] font-mono transition-colors cursor-pointer"
            type="button"
          >
            CLOSE [ESC]
          </button>
        </div>

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
                      data-kt-sticky-mode="EXPLORE"
                      href={service.href}
                      onClick={onClose}
                      onFocus={() => setActiveIdx(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      role="tab"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[#59626A]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span>{service.title}</span>
                      </span>
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

          {/* Right Active Service World Media with Route Geometry Inset */}
          <div className={styles.serviceIndexRight}>
            <div
              className={styles.serviceMediaStage}
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%)",
              }}
            >
              <Image
                alt={activeService.title}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 55vw"
                src={activeService.image}
                style={{ objectFit: "cover" }}
              />
              <div className="absolute top-4 left-4 z-10 px-2 py-0.5 bg-[#0E1012]/80 border border-[#347CFB]/40 text-[10px] font-mono tracking-widest text-[#347CFB] uppercase">
                {activeService.family}
              </div>
            </div>

            <div className={styles.servicePlaneFooterBar}>
              <p className={styles.servicePlaneDesc}>{activeService.detail}</p>
              <Link
                className={styles.servicePlaneDirectAction}
                data-kt-sticky-mode="OPEN"
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
