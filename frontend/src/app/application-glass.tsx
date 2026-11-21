"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { GLASS_PRESETS, GLASS_RENDER_LIMITS as LIMITS } from "./liquid-glass-presets";
import type { GlassPreset } from "./liquid-glass-presets";
import type { GlassBox, GlassCompositor } from "./glass-compositor";
import { GLASS_TARGETS } from "./liquid-glass-targets";
import { paintAtmosphere } from "./glass-atmosphere";
import { loadGlassBackdrop, paintGlassBackdrop } from "./liquid-glass-backdrop";
import { useDesktopPresentation, useTouchPresentation } from "@/lib/use-desktop-presentation";

type Surface = {
  host: HTMLElement; variant: GlassPreset; layer: HTMLDivElement;
  output?: HTMLCanvasElement; position: string; phase: number; hover: number;
  visible: boolean; box?: GlassBox; clip?: GlassBox; radius: number;
  scaleX: number; scaleY: number; scrollX: number; scrollY: number;
};

export default function ApplicationGlass(props: Parameters<typeof GlassEngine>[0]) {
  const desktop = useDesktopPresentation();
  const touch = useTouchPresentation();
  return desktop === false && touch === false ? <GlassEngine {...props} /> : null;
}

function GlassEngine({ scopeRef, sceneRef, view }: { scopeRef: RefObject<HTMLElement | null>; sceneRef: RefObject<HTMLElement | null>; view: string }) {
  const material = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scope = scopeRef.current, visibleBackdrop = material.current;
    if (!scope || !visibleBackdrop) return;
    let cancelled = false, frame = 0, scanFrame = 0, lastFrame = -Infinity;
    let dirty = true, layoutDirty = true, initializing = false, failed = false;
    let compositor: GlassCompositor | undefined, image: HTMLImageElement | undefined;
    let stopCapture: (() => void) | undefined;
    let liveHero = false, measuredCost = 0, quality = 1;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const surfaces = new Map<HTMLElement, Surface>();
    let visible: Surface[] = [];
    const source = document.createElement("canvas");
    const heroFrame = document.createElement("canvas");
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
    paintAtmosphere(visibleBackdrop, view, 0, scrollY, 1);

    const active = () => document.visibilityState === "visible" && !["active", "revealing"].includes(document.documentElement.dataset.entranceState ?? "");
    function wake() {
      if (cancelled || !active()) return;
      if (!frame) frame = requestAnimationFrame(tick);
      if (!compositor && !initializing && !failed) void initialize();
    }
    const invalidate = () => { layoutDirty = true; dirty = true; wake(); };
    const release = (item: Surface) => {
      item.output?.remove(); item.output = undefined;
      delete item.host.dataset.opticalReady;
    };
    const unavailable = () => {
      for (const item of surfaces.values()) release(item);
      scope.dataset.glassSupport = "unavailable";
    };
    async function initialize() {
      initializing = true;
      try {
        const { GlassCompositor: Renderer } = await import("./glass-compositor");
        if (cancelled) return;
        compositor = new Renderer(unavailable); document.body.append(compositor.canvas);
        compositor.canvas.addEventListener("webglcontextrestored", restore);
        scope!.dataset.glassSupport = "optical"; invalidate();
      } catch { failed = true; unavailable(); }
      finally { initializing = false; }
    }
    function restore() { compositor?.destroy(); compositor = undefined; failed = false; wake(); }
    const intersection = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const item = surfaces.get(entry.target as HTMLElement);
        if (item) { item.visible = entry.isIntersecting; item.host.dataset.glassVisible = String(item.visible); if (!item.visible) release(item); }
      }
      invalidate();
    }, { rootMargin: "80px" });
    const sizes = new ResizeObserver(invalidate);
    function add(host: HTMLElement, variant: GlassPreset) {
      if (surfaces.has(host)) return;
      const position = host.style.position;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      const layer = document.createElement("div"); layer.className = `optical-glass optical-glass-${variant}`; layer.setAttribute("aria-hidden", "true");
      const phase = surfaces.size * 2.399;
      host.classList.add("optical-glass-host"); host.dataset.glassVariant = variant;
      layer.style.setProperty("--glass-duration", `${12 + surfaces.size % 7}s`);
      layer.style.setProperty("--glass-delay", `${-phase * 3}s`);
      host.append(layer);
      surfaces.set(host, { host, variant, layer, position, phase, hover: 0, visible: false, radius: 18, scaleX: 1, scaleY: 1, scrollX: 0, scrollY: 0 });
      intersection.observe(host); sizes.observe(host);
    }
    function remove(item: Surface) {
      intersection.unobserve(item.host); sizes.unobserve(item.host); release(item); item.layer.remove();
      item.host.style.position = item.position; item.host.classList.remove("optical-glass-host");
      delete item.host.dataset.glassVariant; delete item.host.dataset.glassVisible; surfaces.delete(item.host);
    }
    function scan() {
      scanFrame = 0;
      for (const item of surfaces.values()) if (!item.host.isConnected) remove(item);
      document.querySelectorAll<HTMLElement>("[data-glass-explicit]").forEach(host => { if (!host.closest("main") || scope!.contains(host)) add(host, host.dataset.glassExplicit as GlassPreset); });
      document.querySelectorAll<HTMLElement>(".command-box,.source-drawer").forEach(host => add(host, "editorial"));
      for (const target of GLASS_TARGETS) scope!.querySelectorAll<HTMLElement>(target.selector).forEach(host => add(host, target.variant));
      invalidate();
    }
    const scheduleScan = () => { if (!scanFrame) scanFrame = requestAnimationFrame(scan); };
    const mutation = new MutationObserver(records => {
      for (const record of records) {
        if (record.target instanceof Element && record.target.closest(".optical-glass,svg")) continue;
        if (record.type === "childList") {
          if ([...record.addedNodes, ...record.removedNodes].some(node => node instanceof HTMLElement && !node.matches(".optical-glass,.optical-output"))) scheduleScan();
        } else if (record.attributeName === "data-glass-explicit") scheduleScan();
        else invalidate(); // Includes GSAP/Framer transforms on ancestors.
      }
    });
    function measure() {
      visible = [];
      const bounds = new Map<HTMLElement, DOMRect>();
      const styles = new Map<HTMLElement, CSSStyleDeclaration>();
      const rectOf = (node: HTMLElement) => { if (!bounds.has(node)) bounds.set(node, node.getBoundingClientRect()); return bounds.get(node)!; };
      const styleOf = (node: HTMLElement) => { if (!styles.has(node)) styles.set(node, getComputedStyle(node)); return styles.get(node)!; };
      for (const item of surfaces.values()) {
        if (!item.visible || !item.host.isConnected) continue;
        const r = rectOf(item.host), css = styleOf(item.host);
        let left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
        // Honour ancestor overflow without changing sticky containing blocks.
        for (let parent = item.host.parentElement; parent && parent !== scope; parent = parent.parentElement) {
          const style = styleOf(parent);
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
            const clip = rectOf(parent);
            if (style.overflowX !== "visible") { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
            if (style.overflowY !== "visible") { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
          }
        }
        item.box = { x: r.left, y: r.top, width: r.width, height: r.height };
        item.clip = { x: left, y: top, width: right - left, height: bottom - top };
        item.radius = parseFloat(css.borderTopLeftRadius) || GLASS_PRESETS[item.variant].cornerRadius;
        item.scaleX = r.width / (item.host.offsetWidth || r.width); item.scaleY = r.height / (item.host.offsetHeight || r.height);
        item.scrollX = item.host.scrollLeft - item.host.clientLeft; item.scrollY = item.host.scrollTop - item.host.clientTop;
        if (right > left + 1 && bottom > top + 1 && r.width > 2 && css.visibility !== "hidden") visible.push(item);
      }
      // All layout reads precede bitmap/style writes.
      for (const item of surfaces.values()) if (!visible.includes(item)) release(item);
      // Ancestors first, then DOM order. Fixed/sticky navigation and portals are
      // foreground lenses; every host receives the same completed composition.
      const foreground = (item: Surface) => item.host.matches(".command-box,.source-drawer") ? 3 : item.host.closest(".topbar") ? 2 : item.host.matches(".context-strip") ? 1 : 0;
      visible.sort((a, b) => foreground(a) - foreground(b) || (a.host.contains(b.host) ? -1 : b.host.contains(a.host) ? 1 : a.host.compareDocumentPosition(b.host) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      layoutDirty = false;
    }
    function tick(time: number) {
      frame = 0;
      if (cancelled || !active()) return;
      const animate = !media.matches;
      if (dirty || (animate && time - lastFrame >= LIMITS.interval)) {
        const started = performance.now();
        if (layoutDirty) measure();
        const area = visible.reduce((sum, item) => sum + item.clip!.width * item.clip!.height, innerWidth * innerHeight);
        const desiredRatio = Math.sqrt(LIMITS.framePixels / area) * quality;
        const ratio = Math.min(devicePixelRatio || 1, LIMITS.dpr, Math.max(LIMITS.minDpr, Math.floor(desiredRatio * 8) / 8));
        paintAtmosphere(visibleBackdrop!, view, animate ? time : 0, scrollY, ratio);
        if (compositor && !compositor.gl.isContextLost()) {
          if (source.width !== visibleBackdrop!.width || source.height !== visibleBackdrop!.height) { source.width = visibleBackdrop!.width; source.height = visibleBackdrop!.height; }
          const ctx = source.getContext("2d")!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(visibleBackdrop!, 0, 0);
          const hero = sceneRef.current;
          if (view === "Overview" && image && hero && visible.some(item => hero.contains(item.host))) {
            if (liveHero) ctx.drawImage(heroFrame, 0, 0, source.width, source.height);
            else paintGlassBackdrop(source, visibleBackdrop!, hero, image, false, true);
          }
          compositor.upload(source, innerWidth, innerHeight, ratio);
          pointer.x += (pointer.tx - pointer.x) * .22; pointer.y += (pointer.ty - pointer.y) * .22;
          for (const item of visible) {
            item.hover += ((animate && item.host.matches(":hover,:focus-within") ? 1 : 0) - item.hover) * .18;
            compositor.render(item.box!, item.clip!, GLASS_PRESETS[item.variant], item.radius, animate ? time * .001 + item.phase : item.phase, { x: pointer.x, y: pointer.y, hover: animate ? item.hover : 0 }, ratio);
          }
          compositor.capture();
          for (const item of visible) {
            const box = item.box!, clip = item.clip!;
            const output = item.output ?? document.createElement("canvas");
            compositor.publish(clip, ratio, output);
            item.layer.style.transform = `translate(${item.scrollX}px,${item.scrollY}px)`;
            output.style.cssText = `left:${(clip.x - box.x) / item.scaleX}px;top:${(clip.y - box.y) / item.scaleY}px;width:${clip.width / item.scaleX}px;height:${clip.height / item.scaleY}px`;
            if (!item.output) { output.className = "optical-output"; item.layer.prepend(output); item.output = output; }
            item.host.dataset.opticalReady = "true";
          }
        }
        measuredCost = measuredCost * .9 + (performance.now() - started) * .1;
        // Reduce resolution under load, never the set of refractive panels.
        if (measuredCost > 22) quality = Math.max(.65, quality - .025);
        else if (measuredCost < 9) quality = Math.min(1, quality + .005);
        dirty = false; lastFrame = time;
      }
      if (animate) frame = requestAnimationFrame(tick);
    }
    const scroll = () => { liveHero = false; invalidate(); };
    const move = (event: PointerEvent) => { pointer.tx = event.clientX; pointer.ty = event.clientY; if (!media.matches) wake(); };
    const entrance = new MutationObserver(invalidate);
    entrance.observe(document.documentElement, { attributes: true, attributeFilter: ["data-entrance-state"] });
    window.addEventListener("ferrum:glass-register", scheduleScan);
    document.addEventListener("scroll", scroll, { passive: true, capture: true });
    window.addEventListener("resize", invalidate, { passive: true }); window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", invalidate); media.addEventListener("change", invalidate);
    scan(); sizes.observe(scope);
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-glass-explicit", "style", "class"] });
    if (view === "Overview") {
      void loadGlassBackdrop().then(value => { if (!cancelled) { image = value; invalidate(); } }).catch(() => {});
      void import("@react-three/fiber").then(({ addAfterEffect }) => {
        if (cancelled) return;
        let captured = -Infinity;
        stopCapture = addAfterEffect(time => {
          const hero = sceneRef.current;
          if (!media.matches && active() && image && hero && visible.some(item => hero.contains(item.host)) && time - captured >= LIMITS.interval) {
            // Copy the existing 3D canvases immediately after their own render.
            heroFrame.width = visibleBackdrop!.width; heroFrame.height = visibleBackdrop!.height;
            paintGlassBackdrop(heroFrame, visibleBackdrop!, hero, image, true, true); liveHero = true; captured = time; dirty = true; wake();
          }
        });
      });
    }
    return () => {
      cancelled = true; cancelAnimationFrame(frame); cancelAnimationFrame(scanFrame); stopCapture?.();
      intersection.disconnect(); sizes.disconnect(); mutation.disconnect(); entrance.disconnect();
      document.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", invalidate); window.removeEventListener("pointermove", move);
      window.removeEventListener("ferrum:glass-register", scheduleScan); document.removeEventListener("visibilitychange", invalidate); media.removeEventListener("change", invalidate);
      compositor?.canvas.removeEventListener("webglcontextrestored", restore); compositor?.destroy();
      for (const item of surfaces.values()) remove(item);
      delete scope.dataset.glassSupport;
    };
  }, [scopeRef, sceneRef, view]);
  return <canvas ref={material} className="glass-material-backdrop" aria-hidden="true" />;
}
