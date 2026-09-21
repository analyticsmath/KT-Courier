"use client";

import Image from "next/image";
import type { MarketplaceCategoryItem } from "./scenes/MarketplaceFivePanelScene";

/** A fixed, viewport-owned media plane used for the marketplace → fan → parcel handoff. */
export function PersistentStoryMediaLayer({ items }: { items: MarketplaceCategoryItem[] }) {
  return (
    <div className="kt-persistent-story-media-layer" data-persistent-story-media aria-hidden="true">
      <div className="kt-persistent-story-media-frame" data-story-media-frame>
        {items.map((item) => (
          <Image
            key={item.id}
            data-story-media-id={item.id}
            src={item.image}
            alt=""
            fill
            sizes="(max-width: 767px) 72vw, 34vw"
            className="kt-persistent-story-media-image"
          />
        ))}
      </div>
      <div data-story-preparation-target className="kt-story-preparation-target" />
    </div>
  );
}
