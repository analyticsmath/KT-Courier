"use client";

import Image from "next/image";
import Link from "next/link";
import { EditorialMotion } from "../redesign/EditorialMotion";
import { OpeningCurtain } from "./OpeningCurtain";
import { HomeStoryMotion } from "./HomeStoryMotion";
import styles from "./home-story.module.css";
import { ConnectionOrbit } from "../editorial/ConnectionOrbit";

const journeys = [
  {
    title: "Tell us what’s going.",
    copy: "A document, a thoughtful gift or your next customer order. Add the pickup, destination and parcel details to get a quote.",
    src: "/media/public/derived/photo-prep-artisan-woodwork-labeling-640w.webp",
    alt: "An online order being packed with clothing and paperwork",
    link: "/quote",
    action: "Start with a quote",
  },
  {
    title: "Make room for the handoff.",
    copy: "Pack it securely, check the contact details and add any collection instructions. Choose a future date when you need to plan ahead.",
    src: "/media/public/editorial/collection.webp",
    alt: "A paper shopping bag being passed across a counter",
    link: "/services/parcel",
    action: "Prepare your parcel",
  },
  {
    title: "Keep the details close.",
    copy: "Your account brings active orders and delivery history together. Return to your order for its latest status updates.",
    src: "/media/public/home/kt-home-13-arrival.webp",
    alt: "A recipient accepting a parcel at her door",
    link: "/track",
    action: "Find your delivery",
  },
];
const local = [
  {
    src: "/media/public/home/kt-home-01-world-market.webp",
    alt: "Independent stalls inside a Johannesburg market",
    title: "The places you know.",
    text: "Independent stores and everyday discoveries.",
  },
  {
    src: "/media/public/editorial/conversation.webp",
    alt: "A florist discussing an arrangement with a customer",
    title: "The people behind them.",
    text: "Real shops. Personal touches. Something worth finding.",
  },
  {
    src: "/media/public/home/kt-home-08-merchant-prepare.webp",
    alt: "A shop owner preparing a carefully wrapped order",
    title: "A little closer to you.",
    text: "Browse the shop, then follow your order in your account.",
  },
];
const choices = [
  {
    title: "Something personal.",
    text: "Parcels, gifts and important documents.",
    href: "/services/parcel",
    image: "/media/public/home/kt-home-09-package-detail.webp",
    alt: "A small wrapped parcel with a handwritten note",
  },
  {
    title: "Something growing.",
    text: "Delivery support for stores and repeat orders.",
    href: "/services/business",
    image: "/media/public/editorial/conversation.webp",
    alt: "A shopkeeper helping a customer at her flower shop",
  },
  {
    title: "Something bigger.",
    text: "Freight and moving, planned around the details.",
    href: "/services/freight",
    image:
      "/media/public/derived/photo-courier-neighborhood-delivery-walk-1440w.webp",
    alt: "A delivery worker carrying a large box to a doorway",
  },
];
export function PublicHomeExperience() {
  return (
    <EditorialMotion className={styles.home}>
      <OpeningCurtain />
      <HomeStoryMotion />
      <section
        className={styles.hero}
        data-home-chapter="opening"
        aria-labelledby="kt-opening-title"
      >
        <div className={styles.heroTop}>
          <h1 id="kt-opening-title" data-wave-title>
            <span>Good things.</span>
            <span>Going places.</span>
          </h1>
          <div className={styles.heroIntro} data-hero-intro>
            <p>
              From the shop around the corner
              <br />
              to the person at the other end.
              <br />
              Let’s bring it closer.
            </p>
            <Link href="/services/parcel" className="kt-pill">
              Send a parcel <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className={styles.heroPhoto} data-hero-window>
          <Image
            src="/media/public/editorial/florist.webp"
            alt="A florist at the door of her neighbourhood flower shop"
            fill
            preload
            sizes="100vw"
          />
          <Link
            className={styles.heroSeal}
            href="#little-connections"
            aria-label="Discover the little connections behind every delivery"
          >
            <span>
              Made of little
              <br />
              connections.
            </span>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <path d="M8 32 32 8M8 8h24v24" />
            </svg>
          </Link>
        </div>
        <nav className={styles.intentBar} aria-label="Start your journey">
          <Link href="/shop">
            Discover the shop <span>↗</span>
          </Link>
          <Link href="/quote">
            Get a delivery quote <span>↗</span>
          </Link>
          <Link href="/track">
            Find your delivery <span>↗</span>
          </Link>
        </nav>
      </section>

      <section
        className={styles.manifesto}
        data-chapter-takeover
        data-home-chapter="connection"
        data-section-transition="rise"
      >
        <h2 data-text-scrub>
          It’s never just a box.
          <br />
          It’s someone’s hard work.
          <br />A small surprise.
          <br />A reason to open the door.
        </h2>
        <div className={styles.manifestoFoot}>
          <span aria-hidden="true">↓</span>
          <p>
            We connect the everyday things that keep your world moving. From a
            single parcel to the next chapter of your business.
          </p>
        </div>
      </section>

      <ConnectionOrbit />

      <section
        className={styles.aperture}
        data-home-chapter="handoff"
        data-orbit-scene
        aria-labelledby="handoff-heading"
      >
        <div className={styles.orbitPhoto} data-orbit-photo>
          <Image
            src="/media/public/editorial/collection.webp"
            alt="A shopping bag changing hands, connecting a store and its customer"
            fill
            sizes="100vw"
          />
        </div>
        <div className={styles.orbitCopy} data-orbit-copy>
          <h2 id="handoff-heading">
            A small handoff.
            <br />A bigger connection.
          </h2>
          <p>
            Sending something should start with a clear next step. Tell us what
            it is, where it’s going and when you need it to move.
          </p>
          <Link className="kt-text-link" href="/quote">
            Let’s get it moving ↗
          </Link>
        </div>
      </section>

      <section
        className={styles.journey}
        data-home-chapter="delivery"
        data-section-transition="open"
        aria-labelledby="journey-heading"
      >
        <div className={styles.chapterHeader}>
          <h2 data-split-heading id="journey-heading">
            From here.
            <br />
            To the next hello.
          </h2>
          <p>
            A little preparation makes a better journey. Here’s where to start.
          </p>
        </div>
        <div className={styles.journeyLayout}>
          <div className={styles.journeyPictures} aria-hidden="true">
            {journeys.map((step, i) => (
              <div key={step.title} data-journey-photo={i}>
                <Image
                  src={step.src}
                  alt=""
                  fill
                  sizes="(max-width:760px) 100vw, 46vw"
                />
              </div>
            ))}
          </div>
          <div className={styles.journeySteps}>
            {journeys.map((step, i) => (
              <article key={step.title} data-journey-step={i}>
                <span className={styles.stepNumber}>0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                <Link href={step.link} className="kt-text-link">
                  {step.action} ↗
                </Link>
                <div className={styles.mobileStepPhoto}>
                  <Image src={step.src} alt={step.alt} fill sizes="90vw" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className={styles.vanChapter}
        data-home-chapter="movement"
        data-vehicle-scene
        data-section-transition="sweep"
      >
        <h2 data-split-heading>
          A little care.
          <br />A long way.
        </h2>
        <div className={styles.vanObject} data-contained-vehicle>
          <Image
            src="/media/public/protagonists/protagonist-van-side-right.webp"
            width={1448}
            height={1086}
            alt="A complete side view of a delivery van"
            sizes="(max-width:760px) 88vw, 65vw"
          />
        </div>
        <div className={styles.vehicleCaption}>
          <p>
            A parcel for someone you love.
            <br />
            An order someone’s waiting for.
          </p>
          <Link href="/services/parcel" className="kt-text-link">
            Meet your everyday delivery ↗
          </Link>
        </div>
      </section>

      <section
        className={styles.local}
        data-chapter-takeover
        data-home-chapter="local"
        data-section-transition="open"
        aria-labelledby="local-heading"
      >
        <div className={styles.chapterHeader}>
          <h2 id="local-heading" data-split-heading>
            Your next favourite.
            <br />
            Closer than you think.
          </h2>
          <Link href="/shop" className="kt-pill">
            Explore the shop <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={styles.localGallery}>
          {local.map((item, i) => (
            <figure key={item.title} data-gallery-drift={i}>
              <div>
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(max-width:760px) 90vw, 43vw"
                  data-parallax
                />
              </div>
              <figcaption>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section
        className={styles.business}
        data-chapter-takeover
        data-home-chapter="business"
        data-section-transition="rise"
      >
        <div className={styles.businessTitle}>
          <h2 data-split-heading>
            You make it.
            <br />
            Let’s move it.
          </h2>
          <p>For the work behind every order.</p>
        </div>
        <div className={styles.businessComposition}>
          <div className={styles.businessMain} data-media-aperture>
            <Image
              data-parallax
              src="/media/public/home/kt-home-08-merchant-prepare.webp"
              alt="A small-business owner checking and wrapping a customer order"
              fill
              sizes="(max-width:760px) 92vw, 57vw"
            />
          </div>
          <div className={styles.businessDetail}>
            <Image
              src="/media/public/derived/photo-prep-artisan-woodwork-labeling-640w.webp"
              alt="Labels and paperwork being checked before an order leaves"
              fill
              sizes="(max-width:760px) 45vw, 25vw"
            />
          </div>
          <div className={styles.businessCopy}>
            <p>
              Your delivery should fit the way you work. Manage repeat requests,
              return to active orders and keep a record of what’s already moved.
            </p>
            <Link href="/services/business" className="kt-text-link">
              Delivery for your business ↗
            </Link>
            <Link href="/services/ecommerce" className="kt-text-link">
              Explore ecommerce delivery ↗
            </Link>
          </div>
        </div>
      </section>

      <section
        className={styles.coverage}
        data-home-chapter="coverage"
        data-section-transition="sweep"
      >
        <div className={styles.coveragePhoto}>
          <Image
            data-parallax
            src="/media/public/home/kt-home-11-route-city.webp"
            alt="Streets and buildings in Johannesburg"
            fill
            sizes="(max-width:760px) 100vw, 50vw"
          />
        </div>
        <div className={styles.coverageCopy}>
          <h2 data-split-heading>
            Rooted here.
            <br />
            Ready to connect.
          </h2>
          <p>
            Courier operations focus on Gauteng: Johannesburg, Pretoria and
            surrounding areas. Start with your pickup and destination to check
            the route for your service.
          </p>
          <ul>
            <li>Johannesburg</li>
            <li>Pretoria</li>
            <li>Surrounding Gauteng</li>
          </ul>
          <Link href="/coverage-areas" className="kt-text-link">
            Explore delivery coverage ↗
          </Link>
          <small>
            Store availability and courier coverage are separate. Your route is
            confirmed through the quote process.
          </small>
        </div>
      </section>

      <section
        className={styles.choices}
        data-chapter-takeover
        data-home-chapter="services"
        data-section-transition="open"
        aria-labelledby="choices-heading"
      >
        <div className={styles.chapterHeader}>
          <h2 id="choices-heading" data-split-heading>
            What’s your
            <br />
            next move?
          </h2>
          <Link href="/services" className="kt-text-link">
            All delivery services ↗
          </Link>
        </div>
        <div className={styles.choiceList}>
          {choices.map((item, i) => (
            <Link href={item.href} key={item.href} className={styles.choiceRow}>
              <span className={styles.choiceCount}>0{i + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <div className={styles.choicePhoto}>
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(max-width:760px) 28vw, 18vw"
                />
              </div>
              <span className={styles.choiceArrow} aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className={styles.freight}
        data-chapter-takeover
        data-home-chapter="larger-loads"
        data-vehicle-scene
        data-section-transition="rise"
      >
        <h2 data-split-heading>
          When life
          <br />
          gets bigger.
        </h2>
        <div className={styles.truckObject} data-contained-vehicle>
          <Image
            src="/media/public/protagonists/protagonist-truck-red-side-right.webp"
            width={1672}
            height={941}
            alt="A complete freight truck from cab to trailer"
            sizes="90vw"
          />
        </div>
        <div className={styles.vehicleCaption}>
          <p>
            New stock. More space. A new place.
            <br />
            Tell us about the load, access and timing.
            <br />
            We’ll start with the practical details.
          </p>
          <div>
            <Link href="/services/freight" className="kt-pill">
              Explore freight ↗
            </Link>
            <Link href="/services/moving" className="kt-text-link">
              Planning a move? ↗
            </Link>
          </div>
        </div>
      </section>

      <section
        className={styles.packing}
        data-chapter-takeover
        data-home-chapter="packing"
        data-section-transition="open"
      >
        <div className={styles.packingIntro}>
          <h2 data-split-heading>
            A good journey
            <br />
            starts inside.
          </h2>
          <p>
            Before the doorbell.
            <br />
            Before the road.
            <br />A little care with the packing.
          </p>
          <Link href="/services/parcel" className="kt-text-link">
            Your parcel preparation guide ↗
          </Link>
        </div>
        <div className={styles.packingImage} data-media-aperture>
          <Image
            src="/media/public/home/kt-home-09-package-detail.webp"
            alt="A parcel protected with paper and finished with a thank-you note"
            fill
            sizes="(max-width:760px) 90vw, 45vw"
          />
        </div>
        <ol className={styles.packingSteps}>
          <li>
            <span>01</span>
            <div>
              <h3>Give it a safe home.</h3>
              <p>
                Choose a sturdy box and protect the contents so they cannot
                shift.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Make the details clear.</h3>
              <p>
                Check the addresses, recipient contact and any collection
                instructions.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Tell us what matters.</h3>
              <p>
                Include size, weight where applicable and special handling needs
                in your quote.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section
        className={styles.closing}
        data-chapter-takeover
        data-home-chapter="keep-connected"
        data-section-transition="sweep"
      >
        <div>
          <h2 data-split-heading>
            Already on
            <br />
            its way?
          </h2>
          <p>
            Find the latest status for your order.
            <br />
            Your account keeps the journey together.
          </p>
          <Link href="/track" className="kt-pill">
            Find your delivery ↗
          </Link>
        </div>
        <div className={styles.closingPhoto}>
          <Image
            data-parallax
            src="/media/public/home/kt-home-13-arrival.webp"
            alt="A parcel reaching its recipient at the front door"
            fill
            sizes="(max-width:760px) 90vw, 40vw"
          />
        </div>
        <div className={styles.join}>
          <p>
            Know these streets?
            <br />
            There’s a place for you in the story.
          </p>
          <Link href="/services/driver-network" className="kt-text-link">
            Explore the driver network ↗
          </Link>
        </div>
      </section>
    </EditorialMotion>
  );
}
