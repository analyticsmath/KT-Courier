import type { CountInsight } from "@/lib/dashboard-insights/types";
import s from "./workspaceStudio.module.css";
/** Plots use recorded event counts and never infer forecasts. */
export function ActivityIntelligence({
  insight,
  unit = "orders",
}: {
  insight: CountInsight;
  unit?: string;
}) {
  const current = Number(insight.comparison.current),
    previous = Number(insight.comparison.previous);
  const max = Math.max(1, current, previous);
  const cadence = insight.weekdayCounts;
  const peak = Math.max(1, ...(cadence ?? []).map((row) => row.value));
  const total = insight.buckets.reduce((sum, row) => sum + row.value, 0);
  const start = insight.buckets[0]
    ? new Date(insight.buckets[0].start).getTime()
    : 0;
  const end = insight.buckets.length
    ? new Date(insight.buckets[insight.buckets.length - 1].end).getTime()
    : 0;
  const shortWindow = end - start <= 86_400_000;
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    ...(shortWindow
      ? ({ hour: "2-digit", minute: "2-digit" } as const)
      : ({ day: "numeric", month: "short" } as const)),
  });
  const points = insight.buckets.map((row, index) => {
    const cumulative = insight.buckets
      .slice(0, index + 1)
      .reduce((sum, b) => sum + b.value, 0);
    return {
      x:
        20 +
        ((new Date(row.end).getTime() - start) / Math.max(1, end - start)) *
          340,
      y: 130 - (cumulative / Math.max(1, total)) * 105,
      value: cumulative,
      label: formatter.format(new Date(row.end)),
    };
  });
  const last = points.at(-1);
  return (
    <section className={s.intelligence} aria-label={`${unit} activity detail`}>
      <article className={s.cumulativePanel}>
        <div className={s.panelTitle}>
          <h2>Cumulative activity</h2>
          <span className={s.chartChip}>
            {current.toLocaleString("en-ZA")} {unit}
          </span>
        </div>
        <p className={s.chartNote}>
          Recorded totals at the end of each time bucket.
        </p>
        {insight.seriesUnavailable ? (
          <p className={s.chartNote}>
            Choose a shorter period to display the full series.
          </p>
        ) : points.length ? (
          <>
            <svg
              className={s.linePlot}
              viewBox="0 0 400 165"
              role="img"
              aria-label={`Cumulative ${unit}: ${points.map((point) => `${point.label} ${point.value}`).join(", ")}`}
            >
              <path
                d="M20 25H380M20 77H380M20 130H380"
                stroke="#d9e0ed"
                strokeWidth="1"
                fill="none"
              />
              <polyline
                points={[
                  "20,130",
                  ...points.map((point) => `${point.x},${point.y}`),
                ].join(" ")}
                fill="none"
                stroke="#1768ff"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {last ? (
                <>
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r="5"
                    fill="#1768ff"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  <rect
                    x={Math.max(20, last.x - 43)}
                    y={Math.max(1, last.y - 30)}
                    width="54"
                    height="22"
                    rx="11"
                    fill="#191a1e"
                  />
                  <text
                    x={Math.max(20, last.x - 43) + 27}
                    y={Math.max(1, last.y - 30) + 15}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                  >
                    {last.value}
                  </text>
                </>
              ) : null}
              <text x="20" y="155" fontSize="10" fill="#545d6c">
                {formatter.format(new Date(start))}
              </text>
              <text
                x="380"
                y="155"
                textAnchor="end"
                fontSize="10"
                fill="#545d6c"
              >
                {last?.label}
              </text>
            </svg>
            <details className={s.dataDisclosure}>
              <summary>View cumulative data</summary>
              <table>
                <caption>Cumulative {unit}</caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point, i) => (
                    <tr key={i}>
                      <th scope="row">{point.label}</th>
                      <td>{point.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className={s.chartEmpty}>No recorded events in this period.</p>
        )}
      </article>
      <article className={s.comparisonPanel}>
        <div className={s.panelTitle}>
          <h2>Period comparison</h2>
          <span className={s.chartNote}>Equal-duration windows</span>
        </div>
        <div
          className={s.comparisonPlot}
          role="img"
          aria-label={`Previous period: ${previous} ${unit}. Current period: ${current} ${unit}.`}
        >
          {[
            { label: "Previous", value: previous, tone: "previous" },
            { label: "Current", value: current, tone: "current" },
          ].map((row) => (
            <div key={row.label}>
              <div className={s.comparisonTrack}>
                <span
                  data-tone={row.tone}
                  style={{ height: `${(row.value / max) * 100}%` }}
                />
                <strong
                  style={{ bottom: `calc(${(row.value / max) * 100}% + 7px)` }}
                >
                  {row.value.toLocaleString("en-ZA")}
                </strong>
              </div>
              <span>{row.label}</span>
            </div>
          ))}
        </div>
        <p className={s.chartNote}>
          {insight.comparison.changePercent === null
            ? "A percentage comparison needs a non-zero previous period."
            : `${insight.comparison.changePercent > 0 ? "+" : ""}${insight.comparison.changePercent.toFixed(1)}% vs the previous period`}
        </p>
      </article>
      <article className={s.cadencePanel}>
        <div className={s.panelTitle}>
          <h2>Weekly rhythm</h2>
          <span className={s.chartNote}>SAST</span>
        </div>
        <p className={s.chartNote}>
          All selected-period events grouped by weekday.
        </p>
        {cadence ? (
          <div className={s.weekdayPlot} aria-label={`${unit} by weekday`}>
            {cadence.map((row) => (
              <div key={row.label}>
                <span className={s.weekdayValue}>{row.value}</span>
                <div className={s.weekdayTrack}>
                  <span
                    data-peak={
                      (row.value === peak && row.value > 0) || undefined
                    }
                    style={{ height: `${(row.value / peak) * 100}%` }}
                  />
                </div>
                <strong>{row.label}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className={s.chartEmpty}>
            Weekday detail is unavailable for this period.
          </p>
        )}
      </article>
    </section>
  );
}
