"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

const MineralScene = dynamic(() => import("./entrance-mineral-scene"), { ssr: false });
const sessionKey = "ferrum:entrance:seen:v1";
const lightweightEntrance = "(max-width: 1100px), (pointer: coarse)";
let enteredThisRuntime = false;

export type EntranceMotion = { rotation: number; tilt: number; scale: number; push: number };

class MineralBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function MineralFallback() {
  return <svg className="entrance-mineral-fallback" viewBox="0 0 360 440" fill="none" aria-hidden="true">
    <defs><linearGradient id="ore-face" x1="80" y1="100" x2="290" y2="380" gradientUnits="userSpaceOnUse"><stop stopColor="#565b5b" /><stop offset=".4" stopColor="#141819" /><stop offset="1" stopColor="#060809" /></linearGradient><linearGradient id="ore-edge"><stop stopColor="#d3d1c7" /><stop offset="1" stopColor="#62645f" /></linearGradient></defs>
    <path d="M74 107L132 76L180 92L225 34L269 102L274 162L316 214L289 318L236 384L139 407L61 348L39 253L57 174Z" fill="url(#ore-face)" stroke="#747772" strokeWidth=".8" />
    <path d="M225 34L207 121L259 101Z" fill="url(#ore-edge)" /><path d="M225 34L180 92L207 121Z" fill="#3e4343" /><path d="M207 121L259 101L274 162L225 183L192 156Z" fill="#080c0e" />
    <path d="M74 107L104 169L57 174Z" fill="#686c68" /><path d="M104 169L146 143L174 210L119 237L73 208Z" fill="#090d10" stroke="#7f827a" strokeWidth=".6" />
    <path d="M174 210L225 183L259 220L214 258L159 247Z" fill="#444a4b" /><path d="M225 183L274 162L316 214L259 220Z" fill="#8c826c" />
    <path d="M159 247L214 258L254 347L211 387L146 343L126 291Z" fill="#111617" stroke="#9d9887" strokeWidth=".7" /><path d="M214 258L272 256L289 318L254 347Z" fill="#3b3e3b" /><path d="M146 343L211 387L139 407L92 365Z" fill="#242b2d" />
    <path d="M61 348L92 365L126 291L75 272L39 253Z" fill="#12191c" /><path d="M104 169L146 143L180 92L153 187Z" fill="#353c3d" /><path d="M57 174L73 208L54 246L39 253Z" fill="#3c4446" />
    <path d="M87 116L104 169M146 143L153 187L174 210M73 208L119 237L126 291M259 220L272 256M75 272L103 281M211 387L236 384" stroke="#aaa18b" strokeOpacity=".55" strokeWidth=".8" />
  </svg>;
}

export default function CinematicEntrance() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"pending" | "active" | "exiting" | "complete">("pending");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const motion = useRef<EntranceMotion>({ rotation: 0, tilt: 0, scale: 1, push: 0 });
  const completing = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = phase === "active" || phase === "exiting";

  const finish = useCallback(() => {
    enteredThisRuntime = true;
    try { sessionStorage.setItem(sessionKey, "1"); } catch { /* Runtime memory is sufficient. */ }
    document.documentElement.dataset.entranceState = "complete";
    setPhase("complete");
    window.dispatchEvent(new Event("ferrum:entrance-complete"));
  }, []);

  const complete = useCallback(() => {
    if (completing.current) return;
    completing.current = true;
    enteredThisRuntime = true;
    try { sessionStorage.setItem(sessionKey, "1"); } catch { /* Runtime memory is sufficient. */ }
    document.documentElement.dataset.entranceState = "revealing";
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("ferrum:entrance-reveal"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    setPhase("exiting");
    exitTimer.current = setTimeout(finish, window.matchMedia(lightweightEntrance).matches ? 560 : 1100);
  }, [finish]);

  useEffect(() => {
    let seen = enteredThisRuntime;
    try { seen ||= sessionStorage.getItem(sessionKey) === "1"; } catch { /* Storage may be disabled. */ }
    const bypass = pathname !== "/" || Boolean(window.location.hash) || seen;
    if (bypass) {
      enteredThisRuntime = true;
      try { sessionStorage.setItem(sessionKey, "1"); } catch { /* Runtime memory is sufficient. */ }
    }
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
    completing.current = false;
    document.documentElement.dataset.entranceState = bypass ? "complete" : "active";
    const frame = requestAnimationFrame(() => { if (!completing.current) setPhase(bypass ? "complete" : "active"); });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const replay = () => {
      if (window.location.pathname !== "/") return;
      if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
      completing.current = false;
      Object.assign(motion.current, { rotation: 0, tilt: 0, scale: 1, push: 0 });
      setSceneReady(false);
      if (root.current) {
        root.current.scrollTop = 0;
        root.current.style.setProperty("--entrance-progress", "0");
      }
      document.documentElement.dataset.entranceState = "active";
      window.scrollTo({ top: 0, behavior: "instant" });
      setPhase("active");
    };
    window.addEventListener("ferrum:replay-entrance", replay);
    return () => {
      window.removeEventListener("ferrum:replay-entrance", replay);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || pathname !== "/") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let supported = false;
    if (!media.matches && !window.matchMedia(lightweightEntrance).matches) {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2", { powerPreference: "low-power" });
        supported = Boolean(context);
        context?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch { /* The original illustrated mineral remains available. */ }
    }
    const syncMotion = () => { setReducedMotion(media.matches); setWebgl(supported && !media.matches); };
    const syncVisibility = () => setPageVisible(document.visibilityState === "visible");
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const scroller = root.current;
    if (scroller) {
      scroller.scrollTop = 0;
      scroller.style.setProperty("--entrance-progress", "0");
      scroller.focus({ preventScroll: true });
    }
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const earlyKey = (event: globalThis.KeyboardEvent) => {
      if (!event.defaultPrevented && (event.key === "Escape" || (event.key === "Enter" && event.target === document.body))) { event.preventDefault(); complete(); }
    };
    window.addEventListener("keydown", earlyKey);
    return () => window.removeEventListener("keydown", earlyKey);
  }, [isOpen, complete]);

  useEffect(() => {
    if (phase !== "active" || reducedMotion || pathname !== "/" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    import("gsap").then(({ gsap }) => {
      const scroller = root.current;
      if (disposed || !scroller) return;
      const characters = gsap.utils.toArray<HTMLElement>(".entrance-character", scroller);
      const playhead = { progress: 0 };
      const timeline = gsap.timeline({ paused: true });
      const context = gsap.context(() => {
        timeline.to(".entrance-scroll-cue", { opacity: 0, y: 22, duration: .17, ease: "power2.in" }, .03);
        timeline.to(".entrance-material-note", { opacity: 0, y: -15, duration: .15 }, .1);
        characters.forEach((character, index) => {
          const side = index % 2 === 0 ? -1 : 1;
          timeline.to(character, {
            x: side * (60 + index % 5 * 28), y: (index < 6 ? -1 : 1) * (80 + index % 4 * 38),
            z: 100 + index % 3 * 70, rotation: side * (5 + index % 4 * 4), rotationX: side * 20,
            opacity: 0, duration: .28, ease: "power2.in",
          }, .15 + index * .006);
        });
        timeline.to(motion.current, { rotation: 1.6, tilt: -.22, scale: 2.15, push: 2.8, duration: .45, ease: "power2.inOut" }, .38);
        timeline.to(".entrance-dark", { opacity: .94, duration: .4, ease: "power1.inOut" }, .45);
        timeline.to(".entrance-mineral-fallback, .entrance-mineral-still", { scale: 3.6, rotationY: 35, duration: .43, ease: "power2.inOut" }, .4);
        timeline.to(".entrance-topline", { color: "#e0e4e3", duration: .25 }, .49);
        timeline.to(".entrance-world", { opacity: .12, duration: .22, ease: "power2.inOut" }, .73);
        timeline.to(".entrance-orbit", { opacity: 0, scale: 1.5, duration: .25 }, .45);
        timeline.to({}, { duration: .001 }, 1);
      }, scroller);
      let targetProgress = 0;
      const footnote = scroller.querySelector<HTMLElement>(".entrance-footnote");
      const scrub = gsap.quickTo(playhead, "progress", {
        duration: .32, ease: "power2.out",
        onUpdate: () => {
          timeline.progress(playhead.progress);
          footnote?.style.setProperty("--entrance-progress", String(playhead.progress));
        },
        onComplete: () => { if (targetProgress >= .995 && !disposed) complete(); },
      });
      const updateScroll = () => {
        if (completing.current) return;
        targetProgress = Math.min(1, Math.max(0, scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)));
        scrub(targetProgress);
      };
      scroller.dataset.entranceMotionReady = "true";
      scroller.addEventListener("scroll", updateScroll, { passive: true });
      updateScroll();
      const point = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        scroller.style.setProperty("--artifact-x", `${(event.clientX / innerWidth - .5) * 20}px`);
        scroller.style.setProperty("--artifact-y", `${(event.clientY / innerHeight - .5) * 16}px`);
      };
      const resetPoint = () => { scroller.style.setProperty("--artifact-x", "0px"); scroller.style.setProperty("--artifact-y", "0px"); };
      scroller.addEventListener("pointermove", point, { passive: true });
      scroller.addEventListener("pointerleave", resetPoint);
      cleanup = () => {
        delete scroller.dataset.entranceMotionReady;
        scrub.tween.kill();
        footnote?.style.removeProperty("--entrance-progress");
        scroller.removeEventListener("scroll", updateScroll);
        scroller.removeEventListener("pointermove", point);
        scroller.removeEventListener("pointerleave", resetPoint);
        if (completing.current) { timeline.kill(); context.kill(false); }
        else { timeline.revert(); context.revert(); }
        if (!completing.current) Object.assign(motion.current, { rotation: 0, tilt: 0, scale: 1, push: 0 });
      };
    });
    return () => { disposed = true; cleanup?.(); };
  }, [phase, reducedMotion, pathname, complete]);

  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (phase === "exiting" && event.key === "Tab") { event.preventDefault(); return; }
    if (event.key === "Escape" || (event.key === "Enter" && event.target === root.current)) { event.preventDefault(); complete(); }
    if (event.key !== "Tab") return;
    const controls = root.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!controls?.length) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (pathname !== "/" || phase === "complete") return null;
  return <section ref={root} className={`cinematic-entrance${reducedMotion ? " is-reduced" : ""}${phase === "exiting" ? " is-exiting" : ""}`} data-lenis-prevent data-entrance-ready={phase !== "pending" ? "true" : undefined} onScroll={event => { const node = event.currentTarget; if (isOpen && !node.dataset.entranceMotionReady && node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight) >= .995) complete(); }} role="dialog" aria-modal="true" aria-labelledby="entrance-title" aria-describedby="entrance-instructions" tabIndex={-1} onKeyDown={keyboard}>
    <div className="entrance-scroll-track"><div className="entrance-stage">
      <div className="entrance-world" aria-hidden="true"><div className="entrance-silver" /><div className="entrance-dark" /><div className="entrance-ground-shadow" />
        <div className={`entrance-mineral${sceneReady && webgl ? " is-ready" : ""}`}><MineralFallback /><div className="entrance-mineral-still" />{webgl && <MineralBoundary onError={() => setSceneReady(false)}><MineralScene motion={motion} visible={pageVisible} onReady={() => setSceneReady(true)} /></MineralBoundary>}</div>
      </div>
      <div className="entrance-orbit" aria-hidden="true" />
      <div className="entrance-topline"><span>FERRUM <i>RESEARCH</i></span><button data-glass-control="entrance" onClick={complete} disabled={phase === "exiting"}>Skip intro</button></div>
      <h1 className="entrance-title" id="entrance-title" aria-label="Ferrum Research">{["FERRUM", "RESEARCH"].map(word => <span className={`entrance-word entrance-word-${word.toLowerCase()}`} aria-hidden="true" key={word}>{[...word].map((character, index) => <span className="entrance-character" key={`${character}-${index}`}>{character}</span>)}</span>)}</h1>
      <div className="entrance-material-note" aria-hidden="true"><span>A STUDY IN CONTRAST</span><p>Raw material.<br/>Refined perspective.</p></div>
      <div className="entrance-scroll-cue"><span className="entrance-eyebrow">FROM THE ELEMENTS. WITH CONVICTION.</span><button data-glass-control="entrance" onClick={() => { const node = root.current; if (reducedMotion || !node) complete(); else node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }); }} disabled={phase === "exiting"}>{reducedMotion ? "Enter research" : "Scroll to enter"}<span className="entrance-cue-line" aria-hidden="true" /></button><p id="entrance-instructions">{reducedMotion ? "A journal of metals, markets and industry." : "Swipe or scroll to explore."}</p></div>
      <div className="entrance-footnote" aria-hidden="true"><span>METALS &amp; MINING</span><span>INDEPENDENT PERSPECTIVE</span><span>INDIA / 01</span></div>
    </div></div>
  </section>;
}
