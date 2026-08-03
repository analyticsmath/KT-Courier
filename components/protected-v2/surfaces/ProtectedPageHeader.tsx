import { cn } from "@/lib/utils/cn";

type ProtectedPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: readonly { label: string; href?: string }[];
  actions?: React.ReactNode;
  className?: string;
};

export function ProtectedPageHeader({ eyebrow, title, description, breadcrumbs, actions, className }: ProtectedPageHeaderProps) {
  return (
    <header className={cn("eo-page-header", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <ol aria-label="Breadcrumb" className="eo-breadcrumbs">
            {breadcrumbs.map((crumb, index) => <li key={`${crumb.label}-${index}`}>{crumb.href ? <a href={crumb.href}>{crumb.label}</a> : <span aria-current="page">{crumb.label}</span>}</li>)}
          </ol>
        ) : null}
        {eyebrow ? <p className="eo-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="eo-page-header__title">{title}</h1>
        {description ? <p className="eo-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="eo-page-header__actions">{actions}</div> : null}
    </header>
  );
}
