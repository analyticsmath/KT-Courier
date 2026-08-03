import Image from "next/image";
import Link from "next/link";
import { RouteLine } from "@/components/public-v2/graphics";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { PublicBreadcrumbScript } from "@/components/public-v2/support";
import { getR9EntryMedia } from "@/lib/public-assets/r9-entry-media";
import { participationRegistry, type ParticipationDefinition } from "@/lib/public-participation/participation-registry";
import styles from "./participation.module.css";

function PathwayActions({ pathway }: { pathway: ParticipationDefinition }) {
  return (
    <div className={styles.actionGroup}>
      <Link className={styles.primaryAction} href={pathway.primaryAction.href}>{pathway.primaryAction.label}</Link>
      {pathway.secondaryAction ? <Link className={styles.secondaryAction} href={pathway.secondaryAction.href}>{pathway.secondaryAction.label}</Link> : null}
    </div>
  );
}

function PathwaySteps({ pathway }: { pathway: ParticipationDefinition }) {
  return (
    <ol className={styles.steps}>
      {pathway.process.map((step, index) => (
        <li key={step.title}>
          <span aria-hidden="true">0{index + 1}</span>
          <div><h3>{step.title}</h3><p>{step.description}</p></div>
        </li>
      ))}
    </ol>
  );
}

export function ParticipationPage() {
  const store = participationRegistry.STORE;
  const driver = participationRegistry.DRIVER;
  const promoter = participationRegistry.PROMOTER;
  const storeMedia = getR9EntryMedia(store.mediaId);
  const driverMedia = getR9EntryMedia(driver.mediaId);
  const promoterMedia = getR9EntryMedia(promoter.mediaId);

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "Join", href: "/join" }]} />
      <div className={styles.inner}>
        <PublicBreadcrumbs className={styles.breadcrumb} items={[{ label: "Home", href: "/" }, { label: "Join" }]} />
        <section className={styles.hero} aria-labelledby="join-title">
          <div>
            <p className={styles.eyebrow}>Participation</p>
            <h1 id="join-title">There is more than one way to move an order.</h1>
            <p className={styles.lead}>KT Couriers has distinct entry routes for stores, drivers, and promoters. Each route explains what is currently available without turning interest into a promise.</p>
            <nav aria-label="Participation pathways" className={styles.pathwayNav}>
              <a href="#stores">Stores</a><a href="#drivers">Drivers</a><a href="#promoters">Promoters</a>
            </nav>
          </div>
          <div className={styles.routePlane}>
            <p>Choose the pathway that matches your role. Developer integrations have their own route.</p>
            <RouteLine className={styles.routeLine} segment="closing" variant="closing" />
            <Link className={styles.textAction} href="/developers">Developer integrations <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>

      <section className={styles.storeSection} id="stores" aria-labelledby="stores-title">
        <div className={styles.inner}>
          <div className={styles.storeLayout}>
            <figure className={styles.storeMedia}>
              <Image alt={storeMedia.alt} height={storeMedia.height} loading="lazy" sizes="(max-width: 767px) calc(100vw - 40px), 42vw" src={storeMedia.src} width={storeMedia.width} />
              <figcaption><span>EDITORIAL_ONLY</span>Provisional store-operation context</figcaption>
            </figure>
            <div className={styles.pathwayCopy}>
              <p className={styles.eyebrow}>{store.kicker}</p>
              <p className={styles.stateLabel}>{store.stateLabel}</p>
              <h2 id="stores-title">{store.title}</h2>
              <p className={styles.bodyLead}>{store.summary}</p>
              <ul className={styles.requirementList}>{store.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
              <PathwayActions pathway={store} />
            </div>
          </div>
          <PathwaySteps pathway={store} />
        </div>
      </section>

      <section className={styles.driverSection} id="drivers" aria-labelledby="drivers-title">
        <div className={styles.inner}>
          <div className={styles.driverLayout}>
            <div className={styles.pathwayCopy}>
              <p className={styles.eyebrow}>{driver.kicker}</p>
              <p className={styles.stateLabel}>{driver.stateLabel}</p>
              <h2 id="drivers-title">{driver.title}</h2>
              <p className={styles.bodyLead}>{driver.summary}</p>
              <PathwayActions pathway={driver} />
            </div>
            <figure className={styles.driverMedia}>
              <Image alt={driverMedia.alt} height={driverMedia.height} loading="lazy" sizes="(max-width: 767px) calc(100vw - 40px), 36vw" src={driverMedia.src} width={driverMedia.width} />
              <figcaption><span>EDITORIAL_ONLY</span>Provisional driver-network context</figcaption>
            </figure>
          </div>
          <div className={styles.driverDetail}><PathwaySteps pathway={driver} /><aside><h3>What is not published here</h3><p>Vehicle, licence, insurance, screening, work-volume, pay, commission, and approval information are not stated on this page. Use a published opening or the current driver-network route instead.</p></aside></div>
        </div>
      </section>

      <section className={styles.promoterSection} id="promoters" aria-labelledby="promoters-title">
        <div className={styles.inner}>
          <div className={styles.promoterHeader}>
            <div>
              <p className={styles.eyebrow}>{promoter.kicker}</p>
              <p className={styles.stateLabel}>{promoter.stateLabel}</p>
              <h2 id="promoters-title">{promoter.title}</h2>
            </div>
            <p className={styles.bodyLead}>{promoter.summary}</p>
          </div>
          <div className={styles.promoterLayout}>
            <div className={styles.promoterSteps}><PathwaySteps pathway={promoter} /><PathwayActions pathway={promoter} /></div>
            <figure className={styles.promoterMedia}>
              <Image alt={promoterMedia.alt} height={promoterMedia.height} loading="lazy" sizes="(max-width: 767px) calc(100vw - 40px), 42vw" src={promoterMedia.src} width={promoterMedia.width} />
              <figcaption><span>EDITORIAL_ONLY</span>Provisional community-handoff context</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.comparisonSection} aria-labelledby="next-steps-title">
        <div className={styles.inner}>
          <p className={styles.eyebrow}>Next steps</p>
          <h2 id="next-steps-title">Use the route that matches the work.</h2>
          <div className={styles.comparison}>
            {[store, driver, promoter].map((pathway) => <article key={pathway.id}><p>{pathway.title}</p><strong>{pathway.stateLabel}</strong><Link href={pathway.primaryAction.href}>{pathway.primaryAction.label} <span aria-hidden="true">→</span></Link></article>)}
          </div>
          <div className={styles.supportLine}><p>Not sure where your question belongs?</p><Link className={styles.textAction} href="/contact">Contact KT Couriers <span aria-hidden="true">→</span></Link></div>
        </div>
      </section>
    </article>
  );
}
