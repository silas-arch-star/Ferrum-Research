"use client";

import { useEffect } from "react";
import { useDesktopPresentation } from "@/lib/use-desktop-presentation";

export default function HeroMotion({ reducedMotion }: { reducedMotion: boolean | null }) {
  const desktop = useDesktopPresentation();
  useEffect(() => {
    if (desktop !== false || reducedMotion) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const sections = [".recommendation-section", ".universe-section", ".sector-teaser"];
      const context = gsap.context(() => {
        gsap.from(".hero .section-marker, .hero .headline-line, .hero-copy > p, .hero-meta", {
          autoAlpha: 0, y: 22, duration: 0.85, ease: "power3.out", stagger: 0.095, clearProps: "all",
        });
        gsap.from(".hero-network-art", { autoAlpha: 0, duration: 1.05, ease: "power2.out", clearProps: "all" });
        sections.forEach((selector) => {
          const section = document.querySelector<HTMLElement>(selector);
          const heading = section?.querySelector(".section-heading") ?? section?.querySelector("h2");
          if (heading && section) gsap.from(heading, {
            autoAlpha: 0, y: 22, duration: 0.75, ease: "power3.out",
            scrollTrigger: { trigger: section, start: "top 82%", once: true },
          });
        });
      });
      cleanup = () => context.revert();
    });
    return () => { disposed = true; cleanup?.(); };
  }, [desktop, reducedMotion]);
  return null;
}
