import Image from "next/image";
import Link from "next/link";
import type { PublicServicePageDefinition } from "@/lib/public-services/service-page-registry";
import styles from "./service-journey.module.css";
type JourneyPicture = { src: string; alt: string; contain?: boolean };
const pictures: JourneyPicture[] = [
  {
    src: "/media/public/derived/photo-prep-artisan-woodwork-labeling-640w.webp",
    alt: "Details being checked while packing an order",
  },
  {
    src: "/media/public/home/kt-home-08-merchant-prepare.webp",
    alt: "A merchant preparing an order for collection",
  },
  {
    src: "/media/public/home/kt-home-13-arrival.webp",
    alt: "A recipient accepting a delivery at the door",
  },
];
function journeyPictures(
  service: PublicServicePageDefinition,
): JourneyPicture[] {
  const handoff = {
    src: "/media/public/editorial/collection.webp",
    alt: "A paper shopping bag being passed across a counter",
  };
  const road = {
    src: "/media/public/home/kt-home-12-route-road.webp",
    alt: "Traffic moving along a road at sunset",
  };
  const city = {
    src: "/media/public/home/kt-home-11-route-city.webp",
    alt: "Streets and buildings in Johannesburg",
  };
  const box = {
    src: "/media/public/derived/photo-courier-neighborhood-delivery-walk-1440w.webp",
    alt: "A delivery worker carrying a large box to a doorway",
  };
  if (service.id === "food")
    return [
      {
        src: "/media/public/home/kt-home-03-food-local.webp",
        alt: "Prepared meals on a local food counter",
      },
      handoff,
      pictures[2],
    ];
  if (service.id === "grocery")
    return [
      {
        src: "/media/public/home/kt-home-04-grocery.webp",
        alt: "Fresh produce arranged at a market",
      },
      handoff,
      pictures[2],
    ];
  if (service.id === "pharmacy")
    return [
      {
        src: "/media/public/home/kt-home-09-package-detail.webp",
        alt: "A securely wrapped parcel",
      },
      handoff,
      pictures[2],
    ];
  if (service.id === "moving" || service.id === "freight")
    return [
      box,
      road,
      {
        src: "/media/public/protagonists/protagonist-truck-red-side-right.webp",
        alt: "A complete freight truck from cab to trailer",
        contain: true,
      },
    ];
  if (service.id === "driver-network") return [city, box, road];
  if (service.id === "shuttle")
    return [
      city,
      road,
      {
        src: "/media/public/protagonists/protagonist-van-side-right.webp",
        alt: "A complete side view of a delivery van",
        contain: true,
      },
    ];
  return pictures;
}
export function ServiceJourney({
  service,
}: {
  service: PublicServicePageDefinition;
}) {
  const images = journeyPictures(service);
  return (
    <section
      className={styles.journey}
      data-chapter-takeover
      data-section-transition="open"
      aria-labelledby={`${service.id}-journey`}
    >
      <div className={styles.heading}>
        <h2 id={`${service.id}-journey`} data-split-heading>
          {service.id === "driver-network"
            ? "Your next chapter.\nA clear way in."
            : "A clear start.\nA considered journey."}
        </h2>
        <p>
          {service.id === "driver-network"
            ? "Start with your details. Follow the application steps and the document review process."
            : "From the first details to the next step. Here’s how to prepare your request."}
        </p>
      </div>
      <div className={styles.stack} data-process-stack>
        {service.process.map((step, i) => {
          const picture = images[i % images.length];
          return (
            <article
              className={styles.panel}
              key={step.title}
              style={{ top: `calc(100px + ${i * 18}px)` }}
            >
              <div className={styles.photo}>
                <Image
                  src={picture.src}
                  alt={picture.alt}
                  style={picture.contain ? { objectFit: "contain" } : undefined}
                  fill
                  sizes="(max-width:760px) 90vw, 44vw"
                />
              </div>
              <div className={styles.copy}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <Link
                  href={service.primaryAction.href}
                  className="kt-text-link"
                >
                  {service.primaryAction.label} ↗
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
