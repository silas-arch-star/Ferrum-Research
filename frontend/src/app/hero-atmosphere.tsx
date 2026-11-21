"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState } from "react";
import { useDesktopPresentation, useTouchPresentation } from "@/lib/use-desktop-presentation";

const AtmosphereScene = dynamic(() => import("./hero-atmosphere-scene"), { ssr: false });

class AtmosphereBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function HeroAtmosphere() {
  const desktop = useDesktopPresentation();
  const touch = useTouchPresentation();
  return desktop === false && touch === false ? <MobileHeroAtmosphere /> : null;
}

function MobileHeroAtmosphere() {
  const root = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setEnabled(!media.matches);
    const syncPage = () => setPageVisible(document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px 0px" });
    if (root.current) observer.observe(root.current);
    syncMotion();
    syncPage();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncPage);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncPage);
    };
  }, []);

  return <div className="hero-atmosphere" ref={root} aria-hidden="true">
    {enabled && <AtmosphereBoundary><AtmosphereScene visible={visible && pageVisible} /></AtmosphereBoundary>}
  </div>;
}
