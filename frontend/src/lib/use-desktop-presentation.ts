"use client";

import { useSyncExternalStore } from "react";

export const DESKTOP_PRESENTATION_QUERY = "(min-width: 1101px)";
const COMPACT_RESEARCH_QUERY = "(max-width: 800px)";
const TOUCH_PRESENTATION_QUERY = "(max-width: 1100px) and (pointer: coarse)";

function createMediaHook(query: string) {
  const getSnapshot = () => window.matchMedia(query).matches;
  const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  };
  return function useMediaQuery(): boolean | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  };
}

const getServerSnapshot = () => null;

/** Null during hydration prevents either presentation's effects starting early. */
export const useDesktopPresentation = createMediaHook(DESKTOP_PRESENTATION_QUERY);
export const useCompactResearch = createMediaHook(COMPACT_RESEARCH_QUERY);
export const useTouchPresentation = createMediaHook(TOUCH_PRESENTATION_QUERY);
