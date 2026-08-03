import Image from "next/image";
import { RouteLine } from "@/components/public-v2/graphics";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import type { PublicServicePageDefinition } from "@/lib/public-services/service-page-registry";
import styles from "./service-pages.module.css";

export function ServiceNarrative({ service }: { service: PublicServicePageDefinition }) {
  return (
    <section aria-labelledby={`${service.slug}-narrative-heading`} className={styles.section}>
      <p className={styles.sectionEyebrow}>How the request moves forward</p>
      <h2 className={styles.sectionHeading} id={`${service.slug}-narrative-heading`}>A clear path from request to next step.</h2>
      <div className={styles.narrativeGrid} data-kt-narrative-family={service.family}>
        <RouteLine className={styles.narrativeRoute} segment="closing" variant="closing" />
        {service.process.map((step, index) => {
          const media = getServiceMedia(service.detailMediaIds[index % service.detailMediaIds.length]);

          return (
            <article className={styles.narrativeStep} key={step.title}>
              <div className={styles.narrativeImage}>
                <Image alt={media.alt} fill sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 30vw, 28vw" src={media.src} style={{ objectPosition: media.focalPoint }} />
              </div>
              <p className={styles.processNumber}>{String(index + 1).padStart(2, "0")}</p>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
