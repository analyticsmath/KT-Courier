import type { TimeBucket } from "@/lib/dashboard-insights/types";
import s from "./workspaceStudio.module.css";

export type StudioSegment = { label: string; value: number; color: string };

export function ActivityBars({
  buckets,
  label,
}: {
  buckets: readonly TimeBucket[];
  label: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <figure className={s.activity} aria-label={label}>
      <div
        className={s.barPlot}
        role="img"
        aria-label={`${label}. ${buckets.map((b) => `${b.label}: ${b.value}`).join("; ")}`}
      >
        {buckets.map((b, i) => (
          <div className={s.barColumn} key={b.start}>
            <div className={s.barTrack}>
              <span
                style={{ height: `${(b.value / max) * 100}%` }}
                title={`${b.label}: ${b.value}`}
                data-peak={(b.value === max && b.value > 0) || undefined}
              />
            </div>
            <span>
              {buckets.length <= 7 ||
              i === 0 ||
              i === buckets.length - 1 ||
              i % Math.ceil(buckets.length / 4) === 0
                ? b.label
                : ""}
            </span>
          </div>
        ))}
      </div>
      <details className={s.dataDisclosure}>
        <summary>View data</summary>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Orders</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.start}>
                <th scope="row">{b.label}</th>
                <td>{b.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function DistributionRing({
  items,
  label,
  unit = "orders",
}: {
  items: readonly StudioSegment[];
  label: string;
  unit?: string;
}) {
  const total = items.reduce((n, x) => n + x.value, 0);
  const radius = 47;
  const c = 2 * Math.PI * radius;
  return (
    <div className={s.distribution}>
      <div
        className={s.ring}
        role="img"
        aria-label={`${label}: ${items.map((x) => `${x.label} ${x.value}`).join(", ")}. Total ${total}`}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--studio-ring-track, #e6e9f0)"
            strokeWidth="13"
          />
          {items.map((x, i) => {
            const d = (x.value / Math.max(1, total)) * c;
            const o =
              (items.slice(0, i).reduce((sum, item) => sum + item.value, 0) /
                Math.max(1, total)) *
              c;
            return x.value > 0 ? (
              <circle
                key={x.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={x.color}
                strokeWidth="13"
                strokeDasharray={`${Math.max(0, d - 3)} ${c - Math.max(0, d - 3)}`}
                strokeDashoffset={-o}
              />
            ) : null;
          })}
        </svg>
        <div>
          <strong>{total}</strong>
          <span>{total ? unit : "recorded"}</span>
        </div>
      </div>
      <ul className={s.legend}>
        {items.map((x) => (
          <li key={x.label}>
            <span className={s.swatch} style={{ background: x.color }} />
            <span>{x.label}</span>
            <strong>{x.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StageBars({
  items,
  label,
}: {
  items: readonly StudioSegment[];
  label: string;
}) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <div className={s.stages} aria-label={label}>
      {items.map((x) => (
        <div key={x.label}>
          <div>
            <span>{x.label}</span>
            <strong>{x.value}</strong>
          </div>
          <div className={s.stageTrack}>
            <span
              style={{
                width: `${(x.value / max) * 100}%`,
                background: x.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
