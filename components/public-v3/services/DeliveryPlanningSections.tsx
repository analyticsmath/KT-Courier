import Image from "next/image";
import Link from "next/link";
import styles from "./delivery-planning.module.css";

export function ServiceStartingPoints() {
  return (
    <section className={styles.starting} data-section-transition="open">
      <div className={styles.heading}>
        <h2 data-split-heading>
          Different days.
          <br />
          Different deliveries.
        </h2>
        <p>
          Find your starting point, then explore the service that fits what you
          need to move.
        </p>
      </div>
      <div className={styles.paths}>
        <Link href="/services/parcel">
          <span>For your everyday</span>
          <h3>
            A parcel.
            <br />A person.
            <br />A little care.
          </h3>
          <div>
            <Image
              src="/media/public/home/kt-home-09-package-detail.webp"
              alt="A parcel wrapped with a handwritten thank-you note"
              fill
              sizes="(max-width:760px) 90vw, 30vw"
            />
          </div>
          <p>Documents, gifts and personal parcels.</p>
          <b aria-hidden="true">↗</b>
        </Link>
        <Link href="/services/business">
          <span>For your business</span>
          <h3>
            More orders.
            <br />
            Your next
            <br />
            chapter.
          </h3>
          <div>
            <Image
              src="/media/public/editorial/conversation.webp"
              alt="A florist helping a customer in her shop"
              fill
              sizes="(max-width:760px) 90vw, 30vw"
            />
          </div>
          <p>Repeat requests and delivery history.</p>
          <b aria-hidden="true">↗</b>
        </Link>
        <Link href="/services/moving">
          <span>For a bigger move</span>
          <h3>
            New stock.
            <br />
            New spaces.
            <br />
            New plans.
          </h3>
          <div>
            <Image
              src="/media/public/derived/photo-courier-neighborhood-delivery-walk-1440w.webp"
              alt="A delivery worker carrying a large box to a doorway"
              fill
              sizes="(max-width:760px) 90vw, 30vw"
            />
          </div>
          <p>Moving and larger loads, planned ahead.</p>
          <b aria-hidden="true">↗</b>
        </Link>
      </div>
    </section>
  );
}
export function QuotePlanningSection({
  factors,
}: {
  factors?: readonly string[];
}) {
  const items = factors ?? [
    "Pickup and destination addresses, including access instructions.",
    "What you’re sending, its size and weight where applicable.",
    "Your delivery service and a future date if you’re planning ahead.",
  ];
  return (
    <section className={styles.quote} data-section-transition="sweep">
      <div className={styles.quoteImage}>
        <Image
          data-parallax
          src="/media/public/derived/photo-prep-artisan-woodwork-labeling-640w.webp"
          alt="Parcel details and labels being checked while packing an order"
          fill
          sizes="(max-width:760px) 100vw, 48vw"
        />
      </div>
      <div className={styles.quoteCopy}>
        <h2 data-split-heading>
          Good details.
          <br />A clearer quote.
        </h2>
        <p>
          A quote starts with the practical things. Have these ready before you
          begin.
        </p>
        <ol>
          {items.map((item, i) => (
            <li key={item}>
              <span>0{i + 1}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
        <Link href="/quote" className="kt-pill">
          Get a delivery quote ↗
        </Link>
        <small>
          You can get a quote without an account. Sign in when you proceed to
          booking and payment.
        </small>
      </div>
    </section>
  );
}
export function ParcelPackingSection() {
  return (
    <section className={styles.parcel} data-section-transition="open">
      <div className={styles.heading}>
        <h2 data-split-heading>
          Small details.
          <br />
          Better beginnings.
        </h2>
        <p>
          Your parcel has a journey ahead. Give it a good start before
          collection.
        </p>
      </div>
      <div className={styles.parcelLayout}>
        <div className={styles.parcelPhoto} data-media-aperture>
          <Image
            data-parallax
            src="/media/public/home/kt-home-09-package-detail.webp"
            alt="Protective paper packaging around a small parcel"
            fill
            sizes="(max-width:760px) 90vw, 44vw"
          />
        </div>
        <div className={styles.accordion}>
          <details open>
            <summary>
              Choose the right outer box.<span aria-hidden="true">+</span>
            </summary>
            <p>
              Use a sturdy, well-fitting box or protective envelope. Cushion the
              contents and fill empty spaces so items cannot move around inside.
            </p>
          </details>
          <details>
            <summary>
              Seal it for the whole journey.<span aria-hidden="true">+</span>
            </summary>
            <p>
              Close seams securely and remove old shipping labels. Keep the
              recipient details clear and readable.
            </p>
          </details>
          <details>
            <summary>
              Measure before you request.<span aria-hidden="true">+</span>
            </summary>
            <p>
              Have the parcel dimensions, count and weight where applicable
              ready for the quote. Describe the contents and mention handling
              requirements.
            </p>
          </details>
          <details>
            <summary>
              Make collection straightforward.<span aria-hidden="true">+</span>
            </summary>
            <p>
              Confirm pickup and recipient contacts. Add gate access, floor or
              reception instructions and the date if you are planning ahead.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
export function DeliveryCoverageSection() {
  return (
    <section className={styles.coverage} data-section-transition="rise">
      <h2 data-split-heading>
        Start with the route.
        <br />
        We’ll check the fit.
      </h2>
      <div>
        <p>Johannesburg. Pretoria. Surrounding Gauteng.</p>
        <p>
          Courier operations focus on these areas. Your quote checks pickup and
          dropoff against the enabled boundaries for your selected service.
        </p>
        <div className={styles.links}>
          <Link href="/coverage-areas" className="kt-text-link">
            Explore coverage ↗
          </Link>
          <Link href="/contact" className="kt-text-link">
            Talk through your delivery ↗
          </Link>
        </div>
        <small>
          Store availability is separate from courier coverage. Size, handling
          and service availability are confirmed through the quote process.
        </small>
      </div>
    </section>
  );
}
