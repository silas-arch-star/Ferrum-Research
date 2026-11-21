"use client";

import { useEffect, useRef } from "react";
import "./navigation-motion.css";

export function announceNavigation(destination: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ferrum:navigation", { detail: { destination } }));
}

/** A quiet metal seam connects asynchronous route changes without blocking input. */
export default function MotionNavigation() {
  const rail = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const facet = useRef<HTMLElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingPath = "";
    let shownPath = location.pathname;
    let flight: Animation | undefined;
    const motion = matchMedia("(min-width: 1101px) and (prefers-reduced-motion: no-preference)");
    const reset = () => {
      clearTimeout(timer);
      flight?.cancel();
      pendingPath = "";
      delete document.documentElement.dataset.routeArrival;
      if (rail.current) rail.current.dataset.phase = "idle";
    };
    const finish = () => {
      if (!rail.current) return;
      rail.current.dataset.phase = "complete";
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (rail.current) rail.current.dataset.phase = "idle";
        delete document.documentElement.dataset.routeArrival;
        pendingPath = "";
      }, 700);
    };
    const begin = (destination: string, historyMove = false) => {
      if (!motion.matches) return;
      const url = new URL(destination, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === (historyMove ? shownPath : location.pathname)) {
        if (pendingPath && pendingPath !== url.pathname) reset();
        return;
      }
      if (url.pathname === pendingPath && rail.current?.dataset.phase === "travelling") return;
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".module-nav a.module-link")).filter(link => link.getClientRects().length);
      const from = links.find(link => link.classList.contains("active"));
      const to = links.find(link => url.pathname.startsWith("/companies/") || url.hash === "#company-universe"
        ? link.hash === "#company-universe" : link.pathname === url.pathname && !link.hash);
      if (from && to && facet.current && rail.current) {
        const start = from.getBoundingClientRect(), end = to.getBoundingClientRect();
        const x = flight?.playState === "running" ? facet.current.getBoundingClientRect().left : start.left + start.width / 2;
        const destinationX = end.left + end.width / 2;
        const direction = destinationX >= x ? 1 : -1;
        flight?.cancel();
        rail.current.style.setProperty("--facet-y", end.bottom - 2 + "px");
        rail.current.dataset.direction = direction > 0 ? "forward" : "back";
        // Follow the input across the actual nav positions, even during a reversal.
        const pose = (position: number, stretch: number) => `translateX(${position}px) scaleX(${stretch})`;
        flight = facet.current.animate([
          { transform: pose(x, direction * .3), opacity: 0 },
          { transform: pose(x + (destinationX - x) * .55, direction * 1.9), opacity: .94, offset: .38 },
          { transform: pose(destinationX, direction * .2), opacity: 0 },
        ], { duration: 590, easing: "cubic-bezier(.22,.7,.24,1)" });
      }
      pendingPath = url.pathname;
      document.documentElement.dataset.routeArrival = url.pathname;
      const names: Record<string, string> = { "/": "The research journal", "/sector": "Sector research", "/compare": "Across the field", "/rankings": "Three scores. Seven lenses.", "/methodology": "The source trail", "/intelligence": "Evidence & interpretation" };
      if (label.current) label.current.textContent = names[url.pathname] ?? "Company research";
      if (rail.current) rail.current.dataset.phase = "travelling";
      clearTimeout(timer);
      timer = setTimeout(finish, 10000);
    };
    const requested = (event: Event) => begin((event as CustomEvent<{ destination: string }>).detail.destination);
    const click = (event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (link && link.target !== "_blank" && !link.hasAttribute("download")) begin(link.href);
    };
    const ready = (event: Event) => {
      shownPath = (event as CustomEvent<{ path: string }>).detail.path;
      if (shownPath === pendingPath) finish();
    };
    const historyChange = () => begin(location.href, true);
    document.addEventListener("click", click, true);
    window.addEventListener("ferrum:navigation", requested);
    window.addEventListener("ferrum:route-ready", ready);
    window.addEventListener("popstate", historyChange);
    motion.addEventListener("change", reset);
    return () => { reset(); motion.removeEventListener("change", reset); document.removeEventListener("click", click, true); window.removeEventListener("ferrum:navigation", requested); window.removeEventListener("ferrum:route-ready", ready); window.removeEventListener("popstate", historyChange); };
  }, []);
  return <div ref={rail} className="motion-navigation-seam" data-phase="idle" aria-hidden="true"><i /><em /><b ref={facet} className="navigation-facet" /><span ref={label} /></div>;
}
