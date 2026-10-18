"use client";

import Image from "next/image";
import Link from "next/link";
import { EditorialMotion } from "../redesign/EditorialMotion";
const localScenes = [
  {
    src: "/media/public/home/kt-home-01-world-market.webp",
    alt: "Independent stalls and shoppers at a local market",
    title: "Around the corner.",
  },
  {
    src: "/media/public/derived/photo-route-gauteng-transit-corridor-960w.webp",
    alt: "Colourful handmade bags at an independent market stall",
    title: "Out of the ordinary.",
  },
  {
    src: "/media/public/derived/photo-courier-south-african-driver-route-1440w.webp",
    alt: "Locally made preserves on a market table",
    title: "Made with care.",
  },
  {
    src: "/media/public/home/kt-home-08-merchant-prepare.webp",
    alt: "An independent merchant carefully packing a customer order",
    title: "Ready for you.",
  },
];
const services = [
  {
    href: "/services/parcel",
    title: "Send something.",
    copy: "Parcels, documents and the details that matter.",
    src: "/media/public/home/kt-home-09-package-detail.webp",
    alt: "A carefully wrapped parcel with a thank-you note",
  },
  {
    href: "/services/business",
    title: "Build something.",
    copy: "Delivery support for the work you put into your business.",
    src: "/media/public/derived/photo-food-restaurant-dispatch-counter-1440w.webp",
    alt: "A warehouse worker checking stock before dispatch",
  },
  {
    href: "/services/moving",
    title: "Move something.",
    copy: "A little more planning for the larger things in life.",
    src: "/media/public/derived/photo-prep-artisan-box-assembly-960w.webp",
    alt: "Preparing boxes and checking the details of a move",
  },
];

/** Delivery and local life, without a product feed. */
export function PublicHomeExperience() {
  return (
    <EditorialMotion className="kt-home-new kt-home-directed">
      <section
        className="kt-opening kt-directed-opening"
        aria-labelledby="kt-opening-title"
      >
        <h1 id="kt-opening-title" data-title-reveal>
          <span>From your hands.</span>
          <span>To their door.</span>
        </h1>
        <div className="kt-opening-intro">
          <p>
            For the things you make.
            <br />
            The people you care about.
            <br />
            And everything in between.
          </p>
          <div>
            <Link href="/services/parcel" className="kt-pill">
              Send a parcel <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/shop" className="kt-text-link">
              Shop local <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <span className="kt-scroll-hint" aria-hidden="true">
            Scroll to move <span>↓</span>
          </span>
        </div>
        <div className="kt-opening-montage" data-montage>
          <figure className="kt-montage-main">
            <Image
              data-parallax
              src="/media/public/home/kt-home-10-handoff.webp"
              alt="A carefully packed parcel being handed to its recipient"
              fill
              priority
              sizes="(max-width:760px) 100vw, 80vw"
            />
          </figure>
          <figure className="kt-montage-detail">
            <Image
              src="/media/public/derived/photo-prep-workshop-dispatch-desk-1440w.webp"
              alt="A small-business owner preparing products for delivery"
              fill
              priority
              sizes="(max-width:760px) 38vw, 25vw"
            />
          </figure>
          <figure className="kt-montage-city">
            <Image
              src="/media/public/home/kt-home-11-route-city.webp"
              alt="The city streets that connect local businesses and their customers"
              fill
              sizes="(max-width:760px) 32vw, 22vw"
            />
          </figure>
        </div>
      </section>
      <section
        className="kt-journey-scene"
        data-vehicle-scene
        aria-labelledby="kt-move-title"
      >
        <div className="kt-journey-heading" data-reveal>
          <h2 id="kt-move-title">
            A little care.
            <br />A long way.
          </h2>
          <p>
            An order ready to leave the store. A parcel for someone you love.
            Start with the details. We’ll help you take the next step.
          </p>
        </div>
        <div className="kt-vehicle-stage">
          <div className="kt-vehicle-object" data-contained-vehicle>
            <Image
              src="/media/public/protagonists/protagonist-van-side-right.webp"
              width={1448}
              height={1086}
              alt="A complete side view of a KT delivery van"
              sizes="(max-width:760px) 90vw, 76vw"
            />
          </div>
        </div>
        <Link href="/quote" className="kt-pill">
          Get a delivery quote <span aria-hidden="true">↗</span>
        </Link>
      </section>
      <section
        className="kt-local-reel"
        aria-labelledby="kt-local-heading"
        data-local-reel
      >
        <div className="kt-local-reel-heading" data-reveal>
          <h2 id="kt-local-heading">
            There’s a whole
            <br />
            world of local.
          </h2>
          <Link href="/shop" className="kt-text-link">
            Find your next favourite ↗
          </Link>
        </div>
        <div className="kt-reel-window">
          <div className="kt-reel-track">
            {localScenes.map((scene) => (
              <figure className="kt-reel-frame" key={scene.src}>
                <div>
                  <Image
                    src={scene.src}
                    alt={scene.alt}
                    fill
                    sizes="(max-width:760px) 84vw, 42vw"
                  />
                </div>
                <figcaption>{scene.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
        <p className="kt-reel-note">
          Independent stores. Everyday essentials. Unexpected finds.
          <br />
          Discover the people and places behind your next delivery.
        </p>
      </section>
      <section
        className="kt-freight-directed"
        data-vehicle-scene
        aria-labelledby="kt-scale-heading"
      >
        <h2 id="kt-scale-heading" data-reveal>
          Big plans?
          <br />
          Room to move.
        </h2>
        <div className="kt-vehicle-stage kt-truck-stage">
          <div className="kt-vehicle-object" data-contained-vehicle>
            <Image
              src="/media/public/protagonists/protagonist-truck-red-side-right.webp"
              width={1672}
              height={941}
              alt="The complete truck, from the cab to the back of the trailer"
              sizes="(max-width:760px) 90vw, 78vw"
            />
          </div>
        </div>
        <div className="kt-freight-after">
          <p>
            Some deliveries need more space.
            <br />
            Tell us about the load, the locations and what needs to happen.
          </p>
          <Link href="/services/freight" className="kt-pill">
            Explore freight <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="kt-service-cinema" aria-labelledby="kt-fit-heading">
        <h2 id="kt-fit-heading" data-reveal>
          Whatever moves you.
        </h2>
        <div className="kt-service-panels" data-card-sequence>
          {services.map((service) => (
            <Link
              href={service.href}
              className="kt-service-panel"
              key={service.href}
            >
              <div className="kt-service-panel-photo">
                <Image
                  src={service.src}
                  alt={service.alt}
                  fill
                  sizes="(max-width:760px) 90vw, 30vw"
                />
                <span className="kt-panel-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
              <h3>{service.title}</h3>
              <p>{service.copy}</p>
            </Link>
          ))}
        </div>
        <Link href="/services" className="kt-text-link">
          Explore all delivery services ↗
        </Link>
      </section>
    </EditorialMotion>
  );
}
