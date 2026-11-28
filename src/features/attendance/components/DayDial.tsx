import type { ReactNode } from "react";
import type { AttendanceSession } from "../../../lib/shared/types/attendance";
import { minutesOfDay } from "../../../lib/shared/time/attendance";

interface DayDialProps {
  sessions: AttendanceSession[];
  timezone: string;
  now: Date;
  size?: number;
  children?: ReactNode;
  label: string;
}

const DAY = 1440;

/**
 * 24-hour dial — midnight at the top, noon at the bottom. Each session is an
 * arc at its real time (teal), breaks on top (amber), and a dot marks "now"
 * while a session is open. There is deliberately no target: days vary.
 */
export function DayDial({ sessions, timezone, now, size = 236, children, label }: DayDialProps) {
  const stroke = Math.round(size * 0.06);
  const r = size / 2 - stroke / 2 - 4;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const nowMin = minutesOfDay(now, timezone);

  const span = (startIso: string, endIso: string | null) => {
    const a = minutesOfDay(new Date(startIso), timezone);
    let b = endIso ? minutesOfDay(new Date(endIso), timezone) : nowMin;
    if (b < a) b = DAY; // crossed midnight → draw to the top
    return [a, Math.max(b, a + 1)] as const;
  };
  const arc = (a: number, b: number) => ({
    strokeDasharray: `${((b - a) / DAY) * C} ${C}`,
    strokeDashoffset: -(a / DAY) * C,
  });
  const polar = (min: number, radius: number) => {
    const ang = (min / DAY) * 2 * Math.PI - Math.PI / 2;
    return { x: c + radius * Math.cos(ang), y: c + radius * Math.sin(ang) };
  };

  const open = sessions.find((s) => s.clockOut === null);
  const onBreak = open?.breaks.some((b) => b.breakEnd === null) ?? false;
  const dot = open ? polar(nowMin, r) : null;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-track" />
        <g transform={`rotate(-90 ${c} ${c})`}>
          {sessions.map((s) => {
            const [a, b] = span(s.clockIn, s.clockOut);
            return (
              <circle
                key={s.id}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                strokeWidth={stroke}
                className="stroke-status-live-fill"
                style={arc(a, b)}
              />
            );
          })}
          {sessions.flatMap((s) =>
            s.breaks.map((br) => {
              const [a, b] = span(br.breakStart, br.breakEnd);
              return (
                <circle
                  key={br.id}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  strokeWidth={stroke}
                  className="stroke-status-break-fill"
                  style={arc(a, b)}
                />
              );
            }),
          )}
        </g>
        {[
          [0, "12a"],
          [360, "6a"],
          [720, "12p"],
          [1080, "6p"],
        ].map(([m, t]) => {
          const p = polar(m as number, r - stroke - 8);
          return (
            <text
              key={t}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px] font-semibold"
            >
              {t}
            </text>
          );
        })}
        {dot && (
          <circle
            cx={dot.x}
            cy={dot.y}
            r={stroke / 2 + 1}
            strokeWidth={3}
            className={onBreak ? "fill-card stroke-status-break-fill" : "fill-card stroke-status-live-fill"}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
        {children}
      </div>
    </div>
  );
}
