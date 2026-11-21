"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export default function ChartZoom<T extends { date: string }>({ label, range, rows, children }: {
  label: string;
  range: string;
  rows: T[];
  children: (visible: T[]) => ReactNode;
}) {
  const [zoom, setZoom] = useState({ range, level: 0 });
  const preview = useDeferredValue(zoom);
  const total = rows.length;
  const minimum = Math.min(10, Math.max(2, Math.floor(total / 2)));
  const level = zoom.range === range ? zoom.level : 0;
  const plottedLevel = preview.range === range ? preview.level : 0;
  const visibleCount = Math.round(total * (minimum / total) ** (plottedLevel / 100));
  const visible = useMemo(() => visibleCount === rows.length ? rows : rows.slice(-visibleCount), [rows, visibleCount]);
  const plot = useMemo(() => children(visible), [children, visible]);
  const first = visible[0].date.slice(0, 10);
  const last = visible[visible.length - 1].date.slice(0, 10);

  // Reset the slider when the shared date preset changes, even if the user returns to it later.
  if (zoom.range !== range) setZoom({ range, level: 0 });

  return <>
    <div className="technical-zoom" style={{ "--zoom-progress": `${level}%` } as CSSProperties}>
      <label>
        <span>Zoom</span>
        <input type="range" min={0} max={100} value={level}
          aria-label={`${label} zoom`}
          aria-valuetext={`${visibleCount} trading sessions, from ${first} to ${last}`}
          disabled={total <= minimum}
          onChange={event => setZoom({ range, level: event.currentTarget.valueAsNumber })} />
      </label>
      <span className="technical-zoom-window">{level === 0 ? "Full range" : `${first} to ${last}`}</span>
    </div>
    {plot}
  </>;
}
