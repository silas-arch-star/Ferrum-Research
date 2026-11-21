"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Tooltip as RechartsTooltip } from "recharts";
import type { TooltipContentProps, TooltipProps } from "recharts";

type Value = string | number | ReadonlyArray<string | number>;
type Name = string | number;
type Reading = { name: ReactNode; value: ReactNode; color?: string };
type PointReading = { title: string; readings: { name: string; value: string; color?: string }[] };

function ChartReadout({ title, readings }: { title?: ReactNode; readings: Reading[] }) {
  return <div className="chart-tooltip" role="tooltip">
    {title != null && <div className="chart-tooltip-heading">{title}</div>}
    <dl>{readings.map(({ name, value, color }, index) => <div className="chart-tooltip-row" key={index}>
      <dt><i aria-hidden="true" style={color ? { backgroundColor: color } : undefined} /><span>{name}</span></dt>
      <dd>{value}</dd>
    </div>)}</dl>
  </div>;
}

function TooltipContent({ active, label, labelFormatter, payload, formatter }: TooltipContentProps<Value, Name>) {
  if (!active || !payload.length) return null;
  const readings = payload.flatMap((item, index) => {
    if (item.value == null || item.type === "none") return [];
    const format = item.formatter ?? formatter;
    const result = format?.(item.value, item.name ?? "", item, index, payload);
    const value = Array.isArray(result) ? result[0] : result ?? item.value;
    const name = Array.isArray(result) ? result[1] : item.name;
    return [{ name, value, color: item.color ?? item.stroke ?? item.fill }];
  });
  if (!readings.length) return null;
  return <ChartReadout title={labelFormatter?.(label, payload) ?? label} readings={readings} />;
}

export function Tooltip(props: TooltipProps<Value, Name>) {
  return <RechartsTooltip {...props} offset={14} animationDuration={150} animationEasing="ease-out"
    wrapperStyle={{ pointerEvents: "none", zIndex: 8 }} content={TooltipContent} />;
}

export function pointReadout(title: string, readings: PointReading["readings"]) {
  return { "data-chart-readout": JSON.stringify({ title, readings }) };
}

/** Shared tooltip for the SVG plots and other points rendered outside Recharts. */
export function ChartPointTooltip() {
  const [point, setPoint] = useState<(PointReading & { left: number; top: number; above: boolean }) | null>(null);
  useEffect(() => {
    let active: Element | null = null;
    const target = (node: EventTarget | null) => node instanceof Element ? node.closest("[data-chart-readout]") : null;
    const hide = () => {
      if (!active) return;
      active = null;
      setPoint(null);
    };
    const show = (event: Event) => {
      const mark = target(event.target);
      if (!mark || active === mark) return;
      const raw = mark.getAttribute("data-chart-readout");
      if (!raw) return;
      const bounds = mark.getBoundingClientRect();
      const above = bounds.bottom + 180 > innerHeight;
      const left = Math.max(12, Math.min(bounds.left + bounds.width / 2 - 130, innerWidth - 272));
      active = mark;
      setPoint({ ...JSON.parse(raw) as PointReading, left, top: above ? bounds.top - 10 : bounds.bottom + 10, above });
    };
    const tap = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (target(event.target)) show(event);
      else hide();
    };
    const leave = (event: PointerEvent | FocusEvent) => {
      if ("pointerType" in event && event.pointerType === "touch") return;
      if (active && target(event.target) === active && target(event.relatedTarget) !== active) hide();
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("pointerdown", tap, { passive: true });
    document.addEventListener("pointerover", show, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", leave);
    document.addEventListener("keydown", keyboard);
    document.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("resize", hide, { passive: true });
    window.addEventListener("ferrum:navigation", hide);
    window.addEventListener("ferrum:route-ready", hide);
    return () => {
      document.removeEventListener("pointerdown", tap);
      document.removeEventListener("pointerover", show);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", show);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("ferrum:navigation", hide);
      window.removeEventListener("ferrum:route-ready", hide);
    };
  }, []);
  return point && <div className="chart-point-readout" data-above={point.above} style={{ left: point.left, top: point.top }}>
    <ChartReadout title={point.title} readings={point.readings} />
  </div>;
}
