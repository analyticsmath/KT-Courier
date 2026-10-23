"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { refreshPublicMotion } from "../redesign/motion-refresh";
import styles from "./connection-orbit.module.css";

const scenes = [
  {
    src: "/media/public/home/kt-home-09-package-detail.webp",
    x: 50,
    y: 9,
    rotate: -10,
  },
  { src: "/media/public/editorial/conversation.webp", x: 85, y: 27, rotate: 9 },
  {
    src: "/media/public/home/kt-home-13-arrival.webp",
    x: 85,
    y: 72,
    rotate: -7,
  },
  {
    src: "/media/public/home/kt-home-11-route-city.webp",
    x: 50,
    y: 89,
    rotate: 7,
  },
  {
    src: "/media/public/home/kt-home-08-merchant-prepare.webp",
    x: 15,
    y: 72,
    rotate: -9,
  },
  {
    src: "/media/public/home/kt-home-01-world-market.webp",
    x: 15,
    y: 27,
    rotate: 10,
  },
];
export function ConnectionOrbit({
  id = "little-connections",
  about = false,
}: {
  id?: string;
  about?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const scene = root.current;
    if (!scene) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      "(min-width:1000px) and (min-height:520px) and (prefers-reduced-motion:no-preference)",
      () => {
        scene.setAttribute("data-orbit-active", "");
        const ctx = gsap.context(() => {
          const cards = scene.querySelectorAll<HTMLElement>(
            "[data-connection-image]",
          );
          gsap.set(cards, { xPercent: -50, yPercent: -50 });
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: scene,
              start: "top 80px",
              end: "+=900",
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          cards.forEach((card, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI) / 3;
            const position = (shift: number) => ({
              x: Math.cos(angle + shift) * scene.clientWidth * 0.35,
              y: Math.sin(angle + shift) * scene.clientHeight * 0.45,
            });
            timeline.fromTo(
              card,
              {
                x: () => position(-0.28).x,
                y: () => position(-0.28).y,
                rotation: scenes[i].rotate - 14,
                scale: 0.75,
              },
              {
                x: () => position(0.28).x,
                y: () => position(0.28).y,
                rotation: scenes[i].rotate + 14,
                scale: 1,
                duration: 1.5,
                ease: "none",
              },
              0,
            );
          });
          const reveal = (event: FocusEvent) => {
            if (event.target === scene) return;
            timeline.scrollTrigger?.kill(true);
            timeline.progress(1);
            refreshPublicMotion();
          };
          scene.addEventListener("focusin", reveal);
          return () => scene.removeEventListener("focusin", reveal);
        }, scene);
        return () => {
          ctx.revert();
          scene.removeAttribute("data-orbit-active");
        };
      },
    );
    refreshPublicMotion();
    return () => media.revert();
  }, []);
  return (
    <section
      ref={root}
      id={id}
      tabIndex={-1}
      className={styles.scene}
      data-connections-scene
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.images} aria-hidden="true">
        {scenes.map((scene) => (
          <div
            key={scene.src}
            className={styles.image}
            data-connection-image
            style={{
              left: `${scene.x}%`,
              top: `${scene.y}%`,
              rotate: `${scene.rotate}deg`,
            }}
          >
            <Image
              src={scene.src}
              alt=""
              fill
              sizes="(max-width:760px) 44vw, 15vw"
            />{" "}
          </div>
        ))}
      </div>
      <div className={styles.copy}>
        <h2 id={`${id}-title`} data-split-heading>
          Little things.
          <br />
          Stronger connections.
        </h2>
        <p>
          {about
            ? "The person making it. The hands preparing it. The road between you. Every delivery brings these worlds a little closer."
            : "A shop you love. A gift you chose. A door opening at the other end. It’s the little connections that make a delivery matter."}
        </p>
        <Link href={about ? "/services" : "/about"} className="kt-text-link">
          {about ? "Find your next move" : "Meet the people behind the journey"}{" "}
          ↗
        </Link>
      </div>
    </section>
  );
}
