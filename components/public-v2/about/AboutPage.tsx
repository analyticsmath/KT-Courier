import Image from "next/image";
import Link from "next/link";
import { EditorialMotion } from "@/components/public-v3/redesign/EditorialMotion";
import { ConnectionOrbit } from "@/components/public-v3/editorial/ConnectionOrbit";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import styles from "@/components/public-v3/editorial/editorial-pages.module.css";

const chapters = [
  {
    title: "It begins with someone.",
    copy: "An independent shop. A carefully chosen gift. An order a customer is waiting for. Behind the delivery is a person with something to send and someone ready to receive it.",
    src: "/media/public/home/kt-home-08-merchant-prepare.webp",
    alt: "A shop owner preparing a customer’s order",
    href: "/shop",
    action: "Discover the shop",
  },
  {
    title: "Care travels with it.",
    copy: "The right packaging. Clear addresses. A practical note for collection. Small details help turn an everyday request into a considered journey.",
    src: "/media/public/derived/photo-prep-artisan-woodwork-labeling-640w.webp",
    alt: "Clothing, parcel labels and paperwork being prepared together",
    href: "/services/parcel",
    action: "Prepare your next parcel",
  },
  {
    title: "A connection at the door.",
    copy: "KT brings delivery requests, account updates and operational coordination together. The journey is shaped around the service, the route and the details of your request.",
    src: "/media/public/home/kt-home-13-arrival.webp",
    alt: "A parcel reaching its recipient at the front door",
    href: "/services",
    action: "Find the right delivery",
  },
];
export function AboutPage() {
  return (
    <EditorialMotion>
      <article className={styles.page}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: publicBreadcrumbJsonLd([
              { label: "Home", href: "/" },
              { label: "About", href: "/about" },
            ]),
          }}
        />
        <section className={styles.hero}>
          <div className={styles.heroHeader}>
            <h1 data-split-heading>
              A little closer.
              <br />
              To each other.
            </h1>
            <div className={styles.heroAside}>
              <p>
                KT Couriers connects local stores, independent senders and
                courier operators. A shared journey, made of little connections.
              </p>
              <Link className="kt-text-link" href="/services">
                Find your next move ↗
              </Link>
            </div>
          </div>
          <div className={styles.heroPhoto} data-media-aperture>
            <Image
              data-parallax
              src="/media/public/home/kt-home-01-world-market.webp"
              alt="People and independent stalls inside a Johannesburg market"
              fill
              preload
              sizes="100vw"
            />
          </div>
          <div className={styles.heroFoot}>
            <p>
              For the things you make. The people you care about. And everything
              in between.
            </p>
            <Link href="#our-story" className="kt-text-link">
              Follow the story ↓
            </Link>
          </div>
        </section>
        <section
          id="our-story"
          className={styles.statement}
          data-chapter-takeover
          data-section-transition="open"
        >
          <h2 data-text-scrub>
            Good things start with people.{" "}
            <span className={styles.inlinePhoto}>
              <Image
                src="/media/public/editorial/conversation.webp"
                alt="A florist speaking with a customer"
                fill
                sizes="180px"
              />
            </span>{" "}
            They grow through care. And they go further when we connect.
          </h2>
          <p>
            Our role is to bring the request, the route and the handoff
            together. So the next step is easier to understand, whether you’re
            sending for yourself or for your business.
          </p>
        </section>
        <ConnectionOrbit id="people-in-the-journey" about />
        <section className={styles.essay} data-section-transition="rise">
          <div className={styles.essayHeader}>
            <h2 data-split-heading>
              Every journey.
              <br />A human story.
            </h2>
            <p>A few of the everyday moments behind the things that move.</p>
          </div>
          {chapters.map((chapter) => (
            <div className={styles.essayRow} key={chapter.title}>
              <div className={styles.essayImage} data-media-aperture>
                <Image
                  data-parallax
                  src={chapter.src}
                  alt={chapter.alt}
                  fill
                  sizes="(max-width:760px) 90vw, 48vw"
                />
              </div>
              <div className={styles.essayCopy}>
                <h3 data-split-heading>{chapter.title}</h3>
                <p data-text-scrub>{chapter.copy}</p>
                <Link href={chapter.href} className="kt-text-link">
                  {chapter.action} ↗
                </Link>
              </div>
            </div>
          ))}
        </section>
        <section
          className={styles.actions}
          data-chapter-takeover
          data-section-transition="open"
        >
          <h2 data-split-heading>
            There’s a place for you
            <br />
            in the story.
          </h2>
          <nav
            className={styles.actionLinks}
            aria-label="Ways to connect with KT"
          >
            <Link href="/services/parcel">
              Send something thoughtful.<span aria-hidden="true">↗</span>
            </Link>
            <Link href="/services/business">
              Build your next chapter.<span aria-hidden="true">↗</span>
            </Link>
            <Link href="/services/driver-network">
              Know these streets?<span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </section>
      </article>
    </EditorialMotion>
  );
}
