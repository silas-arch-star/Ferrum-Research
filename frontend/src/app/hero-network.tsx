"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState } from "react";
import type { Company } from "@/lib/api";
import { useDesktopPresentation, useTouchPresentation } from "@/lib/use-desktop-presentation";

const HeroNetworkScene = dynamic(() => import("./hero-network-scene"), { ssr: false });

class SceneBoundary extends Component<{ children: React.ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function canRenderWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { powerPreference: "low-power" }) ?? canvas.getContext("webgl", { powerPreference: "low-power" });
    const available = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return available;
  } catch {
    return false;
  }
}

export default function HeroNetwork({ companies }: { companies: Company[] }) {
  const desktop = useDesktopPresentation();
  const touch = useTouchPresentation();
  return desktop === false && touch === false ? <MobileHeroNetwork companies={companies} /> : null;
}

function MobileHeroNetwork({ companies }: { companies: Company[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);
  const scoreCount = companies.filter((company) => {
    const fundamental = company.fundamental_research?.["Final Score"];
    const technical = company.technical_research?.["Total Score (100)"];
    return typeof fundamental === "number" && typeof technical === "number" && Number.isFinite(fundamental) && Number.isFinite(technical);
  }).length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const supported = canRenderWebGL();
    const syncMotion = () => { setEnabled(supported && !media.matches); if (media.matches) setReady(false); };
    const syncVisibility = () => setPageVisible(document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px 0px" });
    if (root.current) observer.observe(root.current);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
    };
  }, []);

  return <div className="hero-network" ref={root}>
    <div className="hero-network-art" aria-hidden="true">
      <svg className={`hero-network-fallback${ready ? " is-hidden" : ""}`} viewBox="0 0 500 330" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 205C102 78 175 278 258 143S399 220 486 85M20 250C110 168 178 258 267 210S391 76 480 160" stroke="#777d85" strokeOpacity=".4" strokeWidth=".6"/>
        <path d="M73 179L128 113L193 221L258 143L339 179L415 129M93 217L176 182L267 210L356 142L451 171" stroke="#9ca3ad" strokeOpacity=".32" strokeWidth=".6"/>
        {[ [22,205],[73,179],[93,217],[128,113],[176,182],[193,221],[258,143],[267,210],[339,179],[356,142],[415,129],[451,171],[486,85] ].map(([x,y], index) => <circle key={index} cx={x} cy={y} r={index % 4 === 0 ? 2 : 1.2} fill="#e1e4e8" fillOpacity={index % 3 === 0 ? ".85" : ".48"}/>)}
      </svg>
      {enabled && <SceneBoundary onError={() => setReady(false)}><HeroNetworkScene visible={inView && pageVisible} companies={companies} onReady={() => setReady(true)} /></SceneBoundary>}
    </div>
    <span className="hero-network-index">DECORATIVE FIELD <i /> {scoreCount} SOURCE SCORE PAIRS</span>
  </div>;
}
