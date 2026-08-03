import Image from "next/image";
import { storyImages, type StoryImage, type VisualTone } from "@/lib/constants/homepage-visuals";

const toneClasses: Record<VisualTone, string> = {
  blue: "bg-[var(--kt-blue-soft)] text-[var(--kt-brand-blue)]",
  amber: "bg-[var(--kt-amber-soft)] text-[var(--kt-copper-flame)]",
  mint: "bg-[var(--kt-mint-soft)] text-[var(--kt-green)]",
  lavender: "bg-[var(--kt-lavender-soft)] text-[var(--kt-violet)]",
  cyan: "bg-[var(--kt-cyan-soft)] text-[var(--kt-cyan)]",
};

const sizeClasses: Record<StoryImage["size"], string> = {
  wide: "w-[18rem] sm:w-[24rem] aspect-[1.38]",
  tall: "w-[15.5rem] sm:w-[19rem] aspect-[0.78]",
  square: "w-[16.5rem] sm:w-[20rem] aspect-square",
};

function StoryCard({ item, index, duplicate = false }: { item: StoryImage; index: number; duplicate?: boolean }) {
  return (
    <article
      aria-hidden={duplicate}
      className={`group relative shrink-0 overflow-hidden rounded-[1.7rem] bg-[var(--kt-surface)] kt-card-shadow ${sizeClasses[item.size]} ${
        index % 2 === 1 ? "sm:mt-10" : "sm:mb-10"
      }`}
    >
      <Image
        src={item.src}
        alt={duplicate ? "" : item.alt}
        fill
        sizes="(min-width: 1024px) 384px, 78vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 kt-image-overlay" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${toneClasses[item.tone]}`}>
          {item.label}
        </span>
        <h3 className="mt-3 font-display text-lg font-extrabold">{item.title}</h3>
      </div>
    </article>
  );
}

export function ImageStoryRail() {
  const railItems = [
    ...storyImages.map((item) => ({ item, duplicate: false })),
    ...storyImages.map((item) => ({ item, duplicate: true })),
  ];

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,var(--kt-studio-white)_0%,var(--kt-polar-white)_100%)] py-14 sm:py-20">
      <div className="container-public">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
            Local delivery in motion
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal text-[var(--kt-brand-navy)] text-balance sm:text-5xl">
            From pickup prep to customer handoff.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--kt-text-soft)]">
            Packed orders, city movement and delivery status stay connected from request to drop off.
          </p>
        </div>
      </div>

      <div className="kt-marquee-shell mt-10 overflow-x-auto px-6 pb-4 [scrollbar-width:none] sm:mt-12 md:overflow-hidden md:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max animate-kt-marquee gap-5 pl-6">
          {railItems.map(({ item, duplicate }, index) => (
            <StoryCard
              key={`${item.title}-${duplicate ? "duplicate" : "primary"}-${index}`}
              item={item}
              index={index}
              duplicate={duplicate}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
