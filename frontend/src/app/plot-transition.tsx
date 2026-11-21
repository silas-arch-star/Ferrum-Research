"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Animate a committed data revision while keeping the controls and plot dimensions stable. */
export default function PlotTransition({ revision, children }: { revision: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(revision);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || previous.current === revision) return;
    previous.current = revision;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = node.getBoundingClientRect();
    if (bounds.bottom <= 0 || bounds.top >= innerHeight) return;
    const graphics = [...node.querySelectorAll(".recharts-bar, .recharts-line, .recharts-area, .daily-histogram, .comparison-points, .score-heatmap tbody")];
    const layers = graphics.length ? graphics : [node];
    const options = { duration: 540, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" } as const;
    const animations = layers.map((layer, index) => layer.animate(
      layer.classList.contains("recharts-bar")
        ? [{ opacity: .12, transform: "translateY(5px)" }, { opacity: 1, transform: "none" }]
        : [{ opacity: .15, clipPath: "inset(0 72% 0 0)" }, { opacity: 1, clipPath: "inset(0)" }],
      { ...options, delay: Math.min(index * 48, 160) },
    ));
    node.dataset.plotUpdating = "true";
    let active = true;
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (active) delete node.dataset.plotUpdating;
    });
    return () => { active = false; animations.forEach(animation => animation.cancel()); delete node.dataset.plotUpdating; };
  }, [revision]);
  return <div ref={root} className="plot-transition">{children}</div>;
}
