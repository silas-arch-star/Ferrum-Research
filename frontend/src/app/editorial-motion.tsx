"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { useDesktopPresentation, useTouchPresentation } from "@/lib/use-desktop-presentation";

const chapterSelectors: Record<string, string> = {
  Overview: ".recommendation-section, .universe-section, .sector-teaser",
  Company: ".company-context, .company-panel > .company-section",
  Sector: ".story-sections > section",
  Compare: ".comparison-controls, .comparison-chart, .rank-bars, .side-by-side",
  Rankings: ".category-feature, .ranking-columns > div",
  Methodology: ".method-notes article, .source-inventory > section, .method-reference, .method-limitations",
  Intelligence: ".intel-hero, .intel-controls, .intel-section, .intel-source",
};

export default function EditorialMotion({ view, reducedMotion, ready, scopeRef }: { view: string; reducedMotion: boolean; ready: boolean; scopeRef: RefObject<HTMLElement | null> }) {
  const desktop = useDesktopPresentation();
  const touch = useTouchPresentation();
  useEffect(() => {
    if (!desktop || !ready || view !== "Company") return;
    const scope = scopeRef.current;
    if (!scope) return;
    const links = Array.from(scope.querySelectorAll<HTMLAnchorElement>(".context-strip a"));
    const sections = links.map(link => scope.querySelector<HTMLElement>(`#${CSS.escape(link.hash.slice(1))}`)).filter((node): node is HTMLElement => Boolean(node));
    let offsets: number[] = [];
    let active = "";
    const update = () => {
      const line = window.scrollY + 170;
      let index = offsets.length - 1;
      while (index > 0 && offsets[index] > line) index--;
      const current = sections[index];
      if (!current || current.id === active) return;
      active = current.id;
      links.forEach(link => {
        if (current && link.hash === `#${current.id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const measure = () => {
      offsets = sections.map(section => section.getBoundingClientRect().top + window.scrollY);
      update();
    };
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
    window.addEventListener("scroll", schedule, { passive: true });
    const sizes = new ResizeObserver(measure);
    sizes.observe(scope);
    sections.forEach(section => sizes.observe(section));
    measure();
    return () => { sizes.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); };
  }, [desktop, ready, scopeRef, view]);
  useEffect(() => {
    if (desktop !== false || touch !== false || reducedMotion || !ready) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const chapters = Array.from(document.querySelectorAll<HTMLElement>(chapterSelectors[view] ?? ""));
      chapters.forEach((chapter) => chapter.classList.add("motion-chapter"));
      let lastChapter = "";
      const updateCurrent = () => {
        if (view !== "Company") return;
        const visibleOrder = chapters.filter((chapter) => chapter.id).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const anchor = window.innerHeight * 0.35;
        const current = visibleOrder.filter((chapter) => chapter.getBoundingClientRect().top <= anchor).at(-1) ?? visibleOrder[0];
        if (!current || current.id === lastChapter) return;
        lastChapter = current.id;
        document.querySelectorAll<HTMLAnchorElement>(".context-strip a").forEach((link) => {
          if (link.hash === `#${current.id}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      };
      const context = gsap.context(() => {
        chapters.forEach((chapter) => {
          ScrollTrigger.create({
            trigger: chapter,
            start: "top 78%",
            end: "bottom 22%",
            onUpdate: (self) => {
              chapter.style.setProperty("--chapter-progress", self.progress.toFixed(3));
              chapter.style.setProperty("--wash-x", `${(self.progress - 0.5) * 90}px`);
            },
          });
        });
        if (view === "Company") ScrollTrigger.create({ start: 0, end: () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight), onUpdate: updateCurrent, onRefresh: updateCurrent });
        if (view === "Company") gsap.from(".assessment-row > div", { opacity: 0.35, y: 18, duration: 0.65, stagger: 0.09, ease: "power2.out", clearProps: "opacity,transform", scrollTrigger: { trigger: ".assessment-row", start: "top 86%", once: true } });
        if (view === "Compare") gsap.from(".comparison-controls", { opacity: 0.4, y: 18, duration: 0.7, ease: "power2.out", clearProps: "opacity,transform", scrollTrigger: { trigger: ".comparison-controls", start: "top 84%", once: true } });
        if (view === "Rankings") gsap.from(".ranking-columns > div", { opacity: 0.35, x: 22, duration: 0.65, stagger: 0.12, ease: "power2.out", clearProps: "opacity,transform", scrollTrigger: { trigger: ".ranking-columns", start: "top 82%", once: true } });
        if (view === "Methodology") gsap.from(".method-notes article", { clipPath: "inset(0 0 100% 0)", duration: 0.8, stagger: 0.12, ease: "power2.inOut", clearProps: "clipPath", scrollTrigger: { trigger: ".method-notes", start: "top 84%", once: true } });
        if (view === "Intelligence") gsap.from(".intel-hub-controls", { opacity: 0.4, y: 16, duration: 0.65, ease: "power2.out", clearProps: "opacity,transform", scrollTrigger: { trigger: ".intel-hub-controls", start: "top 84%", once: true } });
      });
      ScrollTrigger.refresh();
      updateCurrent();
      let refreshFrame = 0;
      const resizeObserver = new ResizeObserver(() => {
        if (refreshFrame) return;
        refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; ScrollTrigger.refresh(); });
      });
      const page = document.querySelector<HTMLElement>(".page-container");
      if (page) resizeObserver.observe(page);
      cleanup = () => {
        resizeObserver.disconnect();
        if (refreshFrame) cancelAnimationFrame(refreshFrame);
        context.revert();
        chapters.forEach((chapter) => {
          chapter.classList.remove("motion-chapter");
          chapter.style.removeProperty("--chapter-progress");
          chapter.style.removeProperty("--wash-x");
        });
      };
    });
    return () => { disposed = true; cleanup?.(); };
  }, [desktop, touch, view, reducedMotion, ready]);
  return null;
}
