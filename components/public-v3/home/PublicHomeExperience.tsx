"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EditorialMotion } from "../redesign/EditorialMotion";
import type { HomepageStorefrontPresentation } from "./data/home-storefront-presentation";

interface PublicHomeExperienceProps {
  isStorefrontExposed?: boolean;
  storefrontPresentation?: HomepageStorefrontPresentation | null;
}

export function PublicHomeExperience({
  isStorefrontExposed = false,
  storefrontPresentation,
}: PublicHomeExperienceProps) {
  const opening = useRef<HTMLElement>(null);
  const van = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!opening.current || !van.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          van.current,
          { xPercent: -130, autoAlpha: 0 },
          {
            xPercent: 75,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: opening.current,
              start: "top 78%",
              end: "bottom 10%",
              scrub: 0.3,
              invalidateOnRefresh: true,
            },
          },
        );
      }, opening);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  const products = isStorefrontExposed
    ? (storefrontPresentation?.products.slice(0, 4) ?? [])
    : [];
  return (
    <EditorialMotion className="kt-home-new">
      <section className="kt-opening" aria-labelledby="kt-opening-title">
        <h1 id="kt-opening-title">
          From your hands.
          <br />
          To their door.
        </h1>
        <div className="kt-opening-bottom">
          <div className="kt-opening-copy">
            <p>
              Local shopping. Thoughtful delivery.
              <br />
              The people and places in between.
            </p>
            <Link href="/services/parcel" className="kt-pill">
              Send a parcel <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/shop" className="kt-text-link">
              Shop local <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="kt-opening-photo">
            <Image
              src="/media/public/derived/photo-prep-workshop-dispatch-desk-1440w.webp"
              alt="A small-business owner preparing products for delivery"
              fill
              sizes="(max-width: 760px) 100vw, 63vw"
              priority
            />
            <span className="kt-photo-caption">
              A little care goes a long way.
            </span>
          </div>
        </div>
      </section>
      <section
        ref={opening}
        className="kt-first-move"
        aria-labelledby="kt-move-title"
      >
        <div className="kt-move-copy" data-reveal>
          <h2 id="kt-move-title">
            Small parcel.
            <br />
            Big part of your day.
          </h2>
          <p>
            A document that needs to get there. An order ready to leave the
            store. Start with the details. We’ll help you find the next step.
          </p>
          <Link href="/quote" className="kt-text-link">
            Get a delivery quote ↗
          </Link>
        </div>
        <div className="kt-van-road" aria-hidden="true">
          <div ref={van} className="kt-scroll-van">
            <Image
              src="/media/public/protagonists/protagonist-van-side-right.webp"
              width={1448}
              height={1086}
              alt=""
              sizes="(max-width: 760px) 95vw, 65vw"
            />
          </div>
        </div>
      </section>
      <section className="kt-local-world" aria-labelledby="kt-local-heading">
        <div className="kt-local-heading" data-reveal>
          <h2 id="kt-local-heading">
            Made here.
            <br />
            Found here.
          </h2>
          <p>
            Discover the stores, everyday essentials and independent finds in
            the KT marketplace.
            <Link href="/shop" className="kt-text-link">
              Explore local shopping ↗
            </Link>
          </p>
        </div>
        <div className="kt-photo-field" data-photo-takeover>
          <div className="kt-photo-tall">
            <Image
              data-parallax
              src="/media/public/home/kt-home-01-world-market.webp"
              alt="Independent stalls at a local market"
              fill
              sizes="(max-width:760px) 74vw, 48vw"
            />
          </div>
          <div className="kt-photo-offset">
            <Image
              data-parallax
              src="/media/public/home/kt-home-08-merchant-prepare.webp"
              alt="A merchant preparing an order"
              fill
              sizes="(max-width:760px) 58vw, 35vw"
            />
          </div>
        </div>
        {products.length > 0 && (
          <div
            className="kt-real-products"
            aria-label="Published marketplace products"
          >
            {products.map((product) => (
              <Link key={product.id} href={product.href}>
                <div>
                  <Image
                    src={product.image}
                    alt={product.imageAlt}
                    fill
                    sizes="(max-width:760px) 66vw, 24vw"
                  />
                </div>
                <h3>{product.title}</h3>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="kt-scale-world" aria-labelledby="kt-scale-heading">
        <div data-reveal className="kt-scale-copy">
          <h2 id="kt-scale-heading">
            A different
            <br />
            kind of scale.
          </h2>
          <div>
            <p>
              Some moves need more room. Tell us about the load, the locations
              and the practical details. Our team will review the requirements
              with you.
            </p>
            <Link href="/services/freight" className="kt-text-link">
              Explore freight ↗
            </Link>
          </div>
        </div>
        <div className="kt-freight-plane" aria-hidden="true">
          <Image
            data-lateral
            src="/media/public/protagonists/protagonist-truck-red-centered-hero.webp"
            alt=""
            width={1536}
            height={1024}
            sizes="(max-width:760px) 130vw, 90vw"
          />
        </div>
      </section>
      <section
        className="kt-service-threshold"
        aria-labelledby="kt-fit-heading"
      >
        <div className="kt-service-photo">
          <Image
            data-parallax
            src="/media/public/home/kt-home-10-handoff.webp"
            alt="A parcel changing hands at a delivery"
            fill
            sizes="(max-width:760px) 100vw, 55vw"
          />
        </div>
        <div data-reveal>
          <h2 id="kt-fit-heading">
            Your delivery.
            <br />
            The right way.
          </h2>
          <nav aria-label="Explore delivery services">
            <Link href="/services/parcel">
              Parcels & documents <span>↗</span>
            </Link>
            <Link href="/services/business">
              For your business <span>↗</span>
            </Link>
            <Link href="/services/moving">
              Larger movements <span>↗</span>
            </Link>
          </nav>
          <Link href="/services" className="kt-text-link">
            All delivery services ↗
          </Link>
        </div>
      </section>
    </EditorialMotion>
  );
}
