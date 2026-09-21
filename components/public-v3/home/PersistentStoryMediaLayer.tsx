"use client";

import Image from "next/image";
import type { MarketplaceCategoryItem } from "./scenes/MarketplaceFivePanelScene";
import styles from "./post-hero-scenes.module.css";

/** Fixed media plane that carries the chosen category into Preparation. */
export function PersistentStoryMediaLayer({ items }: { items: MarketplaceCategoryItem[] }) {
  return (
    <div className={styles.storyMediaLayer} data-persistent-story-media aria-hidden="true">
      <div className={styles.storyMediaFrame} data-story-media-frame>
        {items.map((item) => (
          <Image
            key={item.id}
            data-story-media-id={item.id}
            src={item.image}
            alt=""
            fill
            sizes="100vw"
            className={styles.storyMediaImage}
          />
        ))}
      </div>
    </div>
  );
}
