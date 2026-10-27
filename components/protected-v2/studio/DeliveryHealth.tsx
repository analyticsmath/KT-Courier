import { summariseOrderCohort } from "@/lib/dashboard-insights/workflow-summary";
import s from "./workspaceStudio.module.css";
export function DeliveryHealth({
  rows,
  label = "Delivery progress",
}: {
  rows: readonly { status: string; _count: { _all: number } }[];
  label?: string;
}) {
  const data = summariseOrderCohort(rows);
  const stages = [
    { label: "Delivered", value: data.delivered, color: "#1768ff" },
    { label: "In progress", value: data.active, color: "#191a1e" },
    { label: "Needs review", value: data.attention, color: "#efab9f" },
    { label: "Other / closed", value: data.other, color: "#d7dce6" },
  ];
  return (
    <section className={s.health} aria-label={label}>
      <header>
        <div>
          <h2>{label}</h2>
          <p>Current states of orders created in the selected period.</p>
        </div>
        <span>{data.total.toLocaleString("en-ZA")} orders</span>
      </header>
      <div className={s.healthMetrics}>
        <div>
          <strong>
            {data.deliveredShare === null
              ? "—"
              : `${data.deliveredShare.toFixed(1)}%`}
          </strong>
          <span>Delivered share</span>
        </div>
        {stages.slice(1).map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div
        className={s.healthTrack}
        role="img"
        aria-label={stages
          .map((item) => `${item.label}: ${item.value}`)
          .join(", ")}
      >
        {stages.map((item) => (
          <span
            key={item.label}
            style={{
              width: `${data.total ? (item.value / data.total) * 100 : 0}%`,
              background: item.color,
            }}
          />
        ))}
      </div>
      <ul className={s.healthLegend}>
        {stages.map((item) => (
          <li key={item.label}>
            <i aria-hidden="true" style={{ background: item.color }} />
            {item.label} <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
