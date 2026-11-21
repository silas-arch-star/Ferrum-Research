"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const key = "ferrum:desktop-comparison:v1";
const eventName = "ferrum:comparison-change";
let memory = "[]";

function read() {
  try { return sessionStorage.getItem(key) ?? memory; }
  catch { return memory; }
}

function parse(raw: string): string[] {
  try {
    const items: unknown = JSON.parse(raw);
    return Array.isArray(items) ? [...new Set(items.filter((id): id is string => typeof id === "string" && /^C(?:0[1-9]|1[0-9]|20)$/.test(id)))].slice(0, 3) : [];
  } catch { return []; }
}

function subscribe(notify: () => void) {
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", notify); };
}

/** A comparison follows route navigation within the current tab. */
export function useComparison(): [string[], (id: string) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const ids = useMemo(() => parse(raw), [raw]);
  const toggle = useCallback((id: string) => {
    const current = parse(read());
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current.slice(current.length >= 3 ? 1 : 0), id];
    memory = JSON.stringify(next);
    try { sessionStorage.setItem(key, memory); } catch { /* The current tab retains its in-memory selection. */ }
    window.dispatchEvent(new Event(eventName));
  }, []);
  return [ids, toggle];
}
