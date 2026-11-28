import { formatMinutesAsHours } from "../../../lib/shared/time/attendance";

export interface ChartBar {
  key: string;
  label: string;
  minutes: number;
  /** Full label for the tooltip/screen readers, e.g. "Tue 14 Jul". */
  title: string;
}

interface HoursChartProps {
  bars: ChartBar[];
  /** Dashed reference line, e.g. an 8h target day. In minutes. */
  targetMinutes?: number;
  height?: number;
}

/** Dependency-free SVG bar chart. A charting library (recharts ≈ 100 kB gz)
 * is overkill for one bar series, so this draws it directly. */
export function HoursChart({ bars, targetMinutes, height = 180 }: HoursChartProps) {
  const max = Math.max(60, targetMinutes ?? 0, ...bars.map((b) => b.minutes));
  const padTop = 8;
  const padBottom = 22;
  const plotH = height - padTop - padBottom;
  const slot = 100 / Math.max(1, bars.length);
  const barW = slot * 0.68;
  const y = (m: number) => padTop + plotH - (m / max) * plotH;
  const labelEvery = bars.length > 16 ? Math.ceil(bars.length / 10) : 1;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-[180px] w-full overflow-visible"
        role="img"
        aria-label="Worked hours per period"
      >
        <line
          x1="0"
          x2="100"
          y1={y(0)}
          y2={y(0)}
          stroke="var(--border)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {targetMinutes != null && (
          <line
            x1="0"
            x2="100"
            y1={y(targetMinutes)}
            y2={y(targetMinutes)}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            opacity="0.5"
          />
        )}
        {bars.map((b, i) => {
          const h = Math.max(b.minutes > 0 ? 1.5 : 0, y(0) - y(b.minutes));
          return (
            <rect
              key={b.key}
              x={i * slot + (slot - barW) / 2}
              y={y(0) - h}
              width={barW}
              height={h}
              rx="0.6"
              fill="var(--status-live-fill)"
            >
              <title>{`${b.title}: ${formatMinutesAsHours(b.minutes)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
        {bars.map((b, i) =>
          i % labelEvery === 0 ? (
            <span
              key={b.key}
              className="absolute -translate-x-1/2 tabular-nums"
              style={{ left: `${i * slot + slot / 2}%` }}
            >
              {b.label}
            </span>
          ) : null,
        )}
      </div>
    </figure>
  );
}
