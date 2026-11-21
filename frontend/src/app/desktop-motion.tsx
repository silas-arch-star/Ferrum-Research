"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useDesktopPresentation } from "@/lib/use-desktop-presentation";

const revealSelector = ".section-heading,.editorial-heading,.intel-hero,.company-context,.method-notes article,.visual-kpi,.assessment-row > div,.intel-conclusion,.comparison-controls,.category-tabs,.intel-hub-controls";
const chapterSelector = ".recommendation-section,.universe-section,.sector-teaser,.company-section,.intel-section,.method-reference";
const targetSelector = revealSelector + "," + chapterSelector;

/** Decorative motion follows browser scrolling. It never intercepts wheel or touch input. */
export default function DesktopMotion({ view, ready }: { view: string; ready: boolean }) {
  const desktop = useDesktopPresentation();
  const reduced = useReducedMotion();
  const ui = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const percent = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!desktop || !ready) return;
    const html = document.documentElement;
    html.dataset.scrollEngine = "native";
    if (reduced !== false) {
      html.dataset.desktopMotion = "reduced";
      return () => { delete html.dataset.desktopMotion; delete html.dataset.scrollEngine; };
    }

    const scope = ui.current?.closest<HTMLElement>("main.app-shell");
    const content = scope?.querySelector<HTMLElement>(".page-container");
    if (!scope || !content) return;
    const seen = new WeakSet<HTMLElement>();
    const animations = new Set<Animation>();
    const waiting = new Set<HTMLElement>();
    let frame = 0;
    let limit = 0;
    let paused = true;
    let heroPlayed = false;

    const animate = (node: HTMLElement, frames: Keyframe[], duration: number, delay = 0) => {
      const animation = node.animate(frames, { duration, delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    };

    const reveal = (node: HTMLElement) => {
      if (!node.isConnected || seen.has(node)) return;
      if (paused) { waiting.add(node); return; }
      seen.add(node);
      if (node.matches(chapterSelector)) node.dataset.ferrumChapter = "true";
      if (node.matches(revealSelector)) animate(node, [{ opacity: .5, translate: "0 9px" }, { opacity: 1, translate: "0 0" }], 440);
    };

    const playArrival = () => {
      if (view === "Overview" || !document.documentElement.dataset.routeArrival) return;
      const blocks = Array.from(scope.querySelectorAll<HTMLElement>(".editorial-heading,.intel-hero,.company-context,.comparison-controls,.intel-hub-controls,.category-tabs,.assessment-row > div,.sector-story > .section-heading"));
      const visible = blocks.filter(block => {
        const rect = block.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 80;
      });
      const direction = document.querySelector(".motion-navigation-seam")?.getAttribute("data-direction") === "back" ? -1 : 1;
      visible.forEach((block, order) => {
        seen.add(block);
        const title = block.querySelector<HTMLElement>("h1,h2");
        if (title) {
          animate(title, [
            { opacity: .18, translate: `${direction * 14}px 12px`, clipPath: "inset(0 0 32% 0)" },
            { opacity: 1, translate: "0 0", clipPath: "inset(0)" },
          ], 520);
          block.querySelectorAll<HTMLElement>(".section-marker,.eyebrow,p:not(.eyebrow)").forEach((line, index) =>
            animate(line, [{ opacity: .24, translate: `${direction * 9}px 0` }, { opacity: 1, translate: "0 0" }], 400, index * 55));
          return;
        }
        animate(block, [
          { opacity: .45, translate: "0 9px" }, { opacity: 1, translate: "0 0" },
        ], 410, Math.min(order * 42, 126));
      });
    };

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        reveal(entry.target as HTMLElement);
      }
    }, { threshold: .02 });

    const watch = (root: Element) => {
      if (root instanceof HTMLElement && root.matches(targetSelector)) observer.observe(root);
      root.querySelectorAll<HTMLElement>(targetSelector).forEach(node => { if (!seen.has(node)) observer.observe(node); });
    };

    const playHero = () => {
      if (heroPlayed || view !== "Overview") return;
      heroPlayed = true;
      scope.querySelectorAll<HTMLElement>(".hero-copy > .section-marker,.hero-copy .headline-line,.hero-copy > p,.hero-data").forEach((node, index) => {
        animate(node, [{ opacity: .1, translate: "0 14px" }, { opacity: 1, translate: "0 0" }], 560, index * 45);
      });
    };

    const sync = () => {
      const phase = html.dataset.entranceState;
      paused = phase === "active" || phase === "revealing" || document.hidden;
      html.dataset.desktopMotion = paused ? "paused" : "active";
      if (phase === "revealing" || !paused) playHero();
      if (!paused) { waiting.forEach(reveal); waiting.clear(); }
    };

    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (paused) return;
        const progress = limit ? Math.max(0, Math.min(window.scrollY / limit, 1)) : 0;
        if (meter.current) meter.current.style.transform = "scaleY(" + progress + ")";
        const label = Math.round(progress * 100).toString().padStart(2, "0") + "%";
        if (percent.current && percent.current.textContent !== label) percent.current.textContent = label;
      });
    };

    const resize = () => {
      limit = Math.max(0, (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight);
      scroll();
    };

    const anchor = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      if (!link || !link.hash.slice(1)) return;
      const target = scope.querySelector<HTMLElement>("#" + CSS.escape(decodeURIComponent(link.hash.slice(1))));
      if (!target) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(history.state, "", link.hash);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const stateObserver = new MutationObserver(sync);
    stateObserver.observe(html, { attributes: true, attributeFilter: ["data-entrance-state"] });
    const contentObserver = new MutationObserver(records => {
      for (const record of records) {
        if (record.target instanceof Element && record.target.closest(".recharts-wrapper,.chart-tooltip")) continue;
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && !node.closest(".recharts-wrapper,.chart-tooltip")) watch(node);
        }
      }
    });
    contentObserver.observe(content, { childList: true, subtree: true });
    const dimensions = new ResizeObserver(resize);
    dimensions.observe(content);

    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", sync);
    scope.addEventListener("click", anchor);
    watch(content);
    sync();
    if (!paused) playArrival();
    resize();

    return () => {
      observer.disconnect();
      stateObserver.disconnect();
      contentObserver.disconnect();
      dimensions.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      scope.removeEventListener("click", anchor);
      delete html.dataset.desktopMotion;
      delete html.dataset.scrollEngine;
    };
  }, [desktop, reduced, ready, view]);

  if (!desktop) return null;
  return <div ref={ui} className="ferrum-motion-ui" aria-hidden="true">
    <div className="ferrum-reading-rail"><span ref={meter} /><small ref={percent}>00%</small></div>
  </div>;
}
