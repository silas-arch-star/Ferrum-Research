"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { GlassPreset } from "./liquid-glass-presets";

/** Declarative opt-in; the application owns the renderer and its lifecycle. */
export default function LiquidGlassSurface({ preset, enabled = true }: { preset: GlassPreset; sceneRef?: RefObject<HTMLElement | null>; enabled?: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = marker.current?.parentElement;
    if (!host || !enabled) return;
    host.dataset.glassExplicit = preset;
    window.dispatchEvent(new Event("ferrum:glass-register"));
    return () => { delete host.dataset.glassExplicit; };
  }, [preset, enabled]);
  return <span ref={marker} hidden aria-hidden="true" />;
}
