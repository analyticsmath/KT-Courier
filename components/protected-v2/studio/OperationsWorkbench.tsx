"use client";
import { useState } from "react";
import Link from "next/link";
import s from "./workspaceStudio.module.css";
export type WorkbenchRecord = {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  status: string;
  date: string;
  href: string;
};

export function OperationsWorkbench({
  rows,
  title,
  description,
  emptyTitle,
  children,
  dateLabel = "Requested",
}: {
  rows: readonly WorkbenchRecord[];
  title: string;
  description: string;
  emptyTitle: string;
  children?: React.ReactNode;
  dateLabel?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const row = rows.find((x) => x.id === selected) ?? rows[0];
  return (
    <section className={s.workbench} aria-label={title}>
      <header className={s.workbenchHeading}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{rows.length} shown</span>
      </header>
      <div className={s.workbenchBody}>
        <div className={s.recordList} aria-label={`${title} records`}>
          {rows.length ? (
            rows.map((x) => (
              <button
                type="button"
                key={x.id}
                aria-pressed={row?.id === x.id}
                onClick={() => setSelected(x.id)}
              >
                <span className={s.recordGlyph} aria-hidden="true">
                  ↗
                </span>
                <span>
                  <strong>{x.reference}</strong>
                  <small>
                    {x.origin} → {x.destination}
                  </small>
                </span>
                <span className={s.recordState}>{x.status}</span>
              </button>
            ))
          ) : (
            <p className={s.workbenchEmpty}>{emptyTitle}</p>
          )}
        </div>
        <div className={s.recordDetail} aria-live="polite">
          {row ? (
            <>
              <div className={s.detailTop}>
                <span>Selected delivery</span>
                <span>{row.status}</span>
              </div>
              <h3>{row.reference}</h3>
              <div className={s.routeDetail}>
                <div>
                  <span>Collection</span>
                  <strong>{row.origin}</strong>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <span>Destination</span>
                  <strong>{row.destination}</strong>
                </div>
              </div>
              <div className={s.detailFooter}>
                <span>
                  {dateLabel}
                  <br />
                  <strong>{row.date}</strong>
                </span>
                <Link href={row.href}>Review delivery ↗</Link>
              </div>
            </>
          ) : (
            <div className={s.detailEmpty}>
              <span aria-hidden="true">✓</span>
              <h3>Ready for the next delivery</h3>
              <p>New work appears here as it enters the delivery workflow.</p>
            </div>
          )}
        </div>
        {children ? <aside className={s.taskRail}>{children}</aside> : null}
      </div>
    </section>
  );
}
