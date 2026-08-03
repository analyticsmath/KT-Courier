import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type EditorialMediaFrameProps = {
  children: ReactNode;
  caption?: ReactNode;
  label?: ReactNode;
  variant?: "landscape" | "portrait" | "panoramic" | "detail" | "darkScene" | "edgeBleed";
  className?: string;
  mediaClassName?: string;
  captionClassName?: string;
  motionLayer?: string;
};

/**
 * A semantic frame for meaningful editorial imagery. It adds no default visual
 * treatment; the scene owns the crop, ratio, and visual hierarchy.
 */
export function EditorialMediaFrame({
  children,
  caption,
  label,
  variant = "landscape",
  className,
  mediaClassName,
  captionClassName,
  motionLayer,
}: EditorialMediaFrameProps) {
  return (
    <figure className={cn(className)} data-kt-media-frame={variant} data-kt-motion-layer={motionLayer}>
      <div className={cn(mediaClassName)}>{children}</div>
      {caption ? (
        <figcaption className={cn(captionClassName)}>
          {label ? <span>{label}</span> : null}
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
