"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./home-compositions.module.css";

const stories = [
  {
    title: "Everyday discoveries.",
    copy: "A market you know. A shop you haven’t met yet. Start with the people and places that make local shopping worth exploring.",
    image: "/media/public/home/kt-home-01-world-market.webp",
    alt: "People browsing independent stalls inside a Johannesburg market",
    detail: "/media/public/home/kt-home-04-grocery.webp",
    detailAlt: "Fresh produce arranged at a market stall",
    caption: "Good things, found close to home.",
  },
  {
    title: "A personal touch.",
    copy: "The conversation across the counter. The care behind a choice. There’s a person behind every shop, and a story behind every order.",
    image: "/media/public/editorial/conversation.webp",
    alt: "A florist talking with a customer at her flower shop",
    detail: "/media/public/home/kt-home-02-retail-local.webp",
    detailAlt: "Colourful handmade bags displayed at a local market",
    caption: "Small details. A little more character.",
  },
  {
    title: "Something worth sending.",
    copy: "A thoughtful find for someone else, or a little something for you. Explore the shop, then keep your order details together in your account.",
    image: "/media/public/home/kt-home-05-fashion.webp",
    alt: "A handbag being chosen as part of a carefully considered outfit",
    detail: "/media/public/home/kt-home-07-homeware.webp",
    detailAlt: "A small sculptural object photographed in soft daylight",
    caption: "Chosen with someone in mind.",
  },
];

export function NeighbourhoodSpread() {
  const [selected, setSelected] = useState(0);
  return (
    <section
      className={styles.neighbourhood}
      data-home-chapter="local"
      aria-labelledby="local-heading"
    >
      <header className={styles.spreadHeading}>
        <h2
          className={styles.spreadTitle}
          id="local-heading"
          data-split-heading
        >
          Your next favourite.
          <br />
          Closer than you think.
        </h2>
        <Link href="/shop" className="kt-text-link">
          Explore the shop ↗
        </Link>
      </header>
      <div
        className={styles.storyChoices}
        role="group"
        aria-label="Explore local stories"
      >
        {stories.map((story, i) => (
          <button
            type="button"
            key={story.title}
            aria-pressed={selected === i}
            aria-controls="neighbourhood-stories"
            onClick={() => setSelected(i)}
          >
            {story.title}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className={styles.spreadCanvas} id="neighbourhood-stories">
        <div className={styles.spreadMain} data-editorial-fade>
          {stories.map((story, i) => (
            <div
              key={story.title}
              className={styles.storyPhoto}
              data-active={selected === i}
              aria-hidden={selected !== i}
            >
              <Image
                src={story.image}
                alt={story.alt}
                fill
                sizes="(max-width:760px) 100vw, 65vw"
              />
            </div>
          ))}
        </div>
        <div className={styles.spreadAside}>
          <div className={styles.spreadDetail} data-editorial-fade>
            {stories.map((story, i) => (
              <div
                key={story.detail}
                className={styles.storyPhoto}
                data-active={selected === i}
                aria-hidden={selected !== i}
              >
                <Image
                  src={story.detail}
                  alt={story.detailAlt}
                  fill
                  sizes="(max-width:760px) 42vw, 23vw"
                />
              </div>
            ))}
          </div>
          <div
            className={styles.storyCopy}
            aria-live="polite"
            aria-atomic="true"
          >
            <h3>{stories[selected].caption}</h3>
            <p>{stories[selected].copy}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
