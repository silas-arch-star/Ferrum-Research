"use client";

import { useMemo } from "react";
import { Line, usePlotArea, useXAxisScale, useYAxisScale } from "recharts";
import type { PricePoint } from "@/lib/api";

type VolumePoint = PricePoint & { direction: number; highVolume: boolean };
type Histogram = { rows: VolumePoint[]; field: "volume"; name: string } | { rows: PricePoint[]; field: "macd_histogram"; name: string };

/** One path per paint style, with every trading day retained on the tooltip axis. */
export default function DailyHistogram(props: Histogram) {
  const x = useXAxisScale();
  const y = useYAxisScale();
  const plot = usePlotArea();
  const width = Math.min(8, (plot?.width ?? 0) * .8 / props.rows.length);
  const paths = useMemo(() => {
    const result = new Map<string, { fill: string; opacity: number; segments: string[] }>();
    const zero = y?.(0);
    if (!x || !y || !width || zero == null) return result;
    props.rows.forEach((row, index) => {
      const value = row[props.field];
      if (value == null) return;
      const center = x(row.date, { position: "middle" });
      const top = y(value);
      if (center == null || top == null) return;
      let fill = value >= 0 ? "url(#macd-positive-fill)" : "url(#macd-negative-fill)";
      let opacity = 1;
      if (props.field === "volume") {
        const { direction, highVolume } = props.rows[index];
        fill = direction > 0 ? "url(#volume-up-fill)" : direction < 0 ? "url(#volume-down-fill)" : "#777777";
        opacity = highVolume ? 1 : .72;
      }
      const key = fill + opacity;
      const group = result.get(key) ?? { fill, opacity, segments: [] };
      group.segments.push(`M${(center - width / 2).toFixed(2)},${zero.toFixed(2)}V${top.toFixed(2)}h${width.toFixed(2)}V${zero.toFixed(2)}Z`);
      result.set(key, group);
    });
    return result;
  }, [props.rows, props.field, width, x, y]);
  return <>
    <Line dataKey={props.field} name={props.name} dot={false} activeDot={false} stroke="none" isAnimationActive={false} />
    <g className="daily-histogram" aria-hidden="true" pointerEvents="none">
      {Array.from(paths, ([key, group]) => <path key={key} fill={group.fill} opacity={group.opacity} d={group.segments.join("")} />)}
    </g>
  </>;
}
