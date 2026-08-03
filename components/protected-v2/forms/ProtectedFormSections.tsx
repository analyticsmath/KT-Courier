import { useId } from "react";
import { cn } from "@/lib/utils/cn";

export function ProtectedFormSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className={cn("eo-form-section", className)}><header><h2 id={titleId}>{title}</h2>{description ? <p>{description}</p> : null}</header><div className="eo-form-section__content">{children}</div></section>;
}

export function ProtectedErrorSummary({ title = "Please review the highlighted fields", errors, className }: { title?: string; errors: readonly { id: string; message: string }[]; className?: string }) {
  if (!errors.length) return null;
  return <section aria-labelledby="eo-error-summary-title" className={cn("eo-error-summary", className)} role="alert"><h2 id="eo-error-summary-title">{title}</h2><ul>{errors.map((error) => <li key={error.id}><a href={`#${error.id}`}>{error.message}</a></li>)}</ul></section>;
}

export function ProtectedActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("eo-action-bar", className)}>{children}</div>;
}
