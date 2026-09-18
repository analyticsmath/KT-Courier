import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./primitives.module.css";

export type PublicButtonVariant =
  | "primary"
  | "signal"
  | "secondary"
  | "hairline"
  | "transactional"
  | "inline";

export type PublicButtonSize = "sm" | "md" | "lg";

type BaseProps = {
  children: ReactNode;
  variant?: PublicButtonVariant;
  size?: PublicButtonSize;
  arrow?: boolean;
  className?: string;
};

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

export type PublicButtonProps = ButtonAsButton | ButtonAsLink;

export function PublicButton({
  children,
  variant = "primary",
  size = "md",
  arrow = false,
  className = "",
  href,
  ...props
}: PublicButtonProps) {
  const variantClass = {
    primary: styles.variantPrimary,
    signal: styles.variantSignal,
    secondary: styles.variantSecondary,
    hairline: styles.variantHairline,
    transactional: styles.variantTransactional,
    inline: styles.variantInline,
  }[variant];

  const sizeClass = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  }[size];

  const combinedClassName = `${styles.button} ${variantClass} ${variant !== "inline" ? sizeClass : ""} ${className}`.trim();

  const content = (
    <>
      <span>{children}</span>
      {arrow && (
        <span className={styles.arrowIcon}>
          <KtIconArrowRight size={size === "sm" ? 14 : size === "lg" ? 18 : 16} />
        </span>
      )}
    </>
  );

  if (href) {
    const { ...linkProps } = props as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link className={combinedClassName} href={href} {...linkProps}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } = props as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={combinedClassName} type={type} {...buttonProps}>
      {content}
    </button>
  );
}
