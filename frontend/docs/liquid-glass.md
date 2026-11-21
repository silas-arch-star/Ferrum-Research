# Ferrum clear liquid glass - full-size compositor

This replaces the earlier compact-only integration. Clear glass is the default: no material tint, backdrop blur, frosted fill or dark readability wash. Graphite/slate belongs to the visible environment behind the glass.

## Rendering architecture

`ApplicationGlass` owns one lazy `GlassCompositor`, one WebGL context, one shader program and one shared background texture. The package's existing typed material configurations and assignments are retained. Its whole-panel compositor is replaced rather than patched or run alongside a second optical system.

The inspected `@ybouane/liquidglass` 1.0.3 renderer accepts full local panel dimensions. Its DOM compositor also fills uncaptured sample regions with `#ffffff` (`LiquidGlass.js`, `_prepareSceneCanvas`). The earlier integration avoided those regions by excluding large/partially visible panels. Those size, area, visibility and three-surface limits are now removed.

Each frame:

1. Read and cache visible DOM bounds, border radii, ancestor overflow and translation/scale. Invalidate on actual scroll, resize, registration or relevant animation changes. Keep sticky/fixed positioning intact.
2. Paint the visible atmospheric environment. Compose the existing homepage artwork and live Three.js layers where they actually sit behind panels. Financial text and SVG charts are never captured.
3. Upload that complete viewport texture once. Use `texSubImage2D` while dimensions are unchanged.
4. Render every visible lens into one viewport-sized optical composition, ancestors first and navigation/dialogs in front. The shader samples/displaces the actual environment texture, with bevel, moving specular light, edge Fresnel response, restrained dispersion and organic flow.
5. Copy the finished WebGL composition once into a shared 2D snapshot. Publish each host's viewport tile from that snapshot, synchronously in the same task. There are no delayed bitmap queues, opacity fades or settle timers.

No panel-sized FBO pool exists. Resolution responds to visible pixel work and measured render cost, with a 1.25 DPR ceiling and 0.55 floor. The default optical/environment cadence is approximately 30 Hz; scroll and layout changes publish on the next animation frame. All visible surfaces remain optical as resolution adapts. Existing homepage/entrance Three.js rendering remains separate and unchanged.

## Large and partially visible panels

Lens geometry uses the full panel rectangle; raster work uses its intersection with the viewport and ancestor scroll clips. A panel taller than the screen therefore retains its true edge shape and depth as it enters/exits. The viewport boundary never becomes an artificial glass edge. Nested scroll offsets and translated/scaled animation bounds are accounted for.

Texture coordinates are clamped to fully populated viewport texture edges. No nonexistent region is filled white. WebGL uses bottom-left scissor coordinates; DOM tiles and source UVs use top-left coordinates. Reference: [WebGL scissor](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/scissor), [pixel storage conventions](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/pixelStorei).

Large recommendation cards, ranking columns, tables, research panels, chart frames and sector exhibits now receive real shader refraction. Portalled search/source dialogs are registered outside the main container too. The material layer remains behind live content, cannot intercept pointer events and does not alter the Sector article's sticky containing block.

## Environment and motion

`glass-atmosphere.ts` paints the same environment both outside and through lenses: graphite, slate and platinum illumination, fine metallic contours and a second cross-current. Route phases vary the light position and contour composition; scroll adds gentle parallax. Existing homepage ribbon/mineral/particle assets and camera choreography remain intact.

Continuous contour flow, displaced optical detail, independent travelling rim highlights, pointer response and natural hover settling run by default. Explicit OS reduced motion freezes optical/environment time and disables rim motion. Hidden documents suspend the scheduler. Unsupported/lost WebGL uses clear CSS transparency with the visible environment; this fallback is not described as refraction. A restored context rebuilds its resources; route cleanup releases the old context, observers and callbacks.

## Layout corrections

The ranking heading defect originated in the new rounded material border applied to columns that only had `padding-top`, leaving zero horizontal inset. Shared card/control spacing tokens now apply consistent desktop/tablet/mobile padding to ranking cards, research frames, chart containers, methodology sources and Intelligence panels. Long company names wrap. Heading and chart layouts retain their existing responsive structure and local scrolling. No global `overflow: visible` workaround was introduced.

All backdrop-filter blur declarations were removed from the global/shared material styles, including pre-initialization and unsupported-WebGL states. Data labels remain live and sharp. Fixed table headers and tooltips retain solid readable treatments where needed; they are not represented as optical lenses.

## Financial colours

- Fundamental component heatmaps use a fixed 0-100 sequential blue-to-teal scale. These are nonnegative peer-relative scores, not signed returns. Filtering does not renormalize colour. Missing values remain missing; numeric values, units and tooltips remain available.
- Foreground heatmap labels choose black/white for WCAG AA contrast; browser checks verify each actual rendered cell at 4.5:1 or better.
- Annual financial trends and peer bars use stable metric-group colours. The fundamental/technical weighted contributions have separate blue/purple identities.
- Comparison scatter points have stable company colours, a ticker legend, labels/tooltips and keyboard interaction. Rank/leaderboard bars use a sequential teal accent; negative rank-bar values retain red.
- Existing price up/down areas, volume, moving averages, RSI zones, MACD and signal colours remain intact. No indicators, weights, formulas, ranks, financial values or source text changed.

## Files changed

- `src/app/application-glass.tsx` - lifecycle, measurement, clipping, shared texture/snapshot scheduling, portal registration.
- `src/app/glass-compositor.ts` - viewport compositor and refractive shader.
- `src/app/glass-atmosphere.ts` - animated visible/source environment.
- `src/app/liquid-glass-backdrop.ts` - compose preserved homepage artwork into the complete source texture.
- `src/app/liquid-glass-presets.ts` - viewport work budget instead of panel exclusion limits.
- `src/app/liquid-glass-targets.ts` - full-size category surfaces and mobile navigation.
- `src/app/optical-glass.css` - clear materials, spacing tokens, responsive geometry, live rims and analytical colours.
- `src/app/globals.css`, `src/app/liquid-editorial.css` - remove inherited backdrop frosting.
- `src/lib/chart-colors.ts` - fixed score scale and stable analytical colours.
- `src/app/research-visuals.tsx`, `src/app/page.tsx` - colour application/legend and tooltip blur removal only; calculations/data preserved.
- `tests/liquid-glass-scroll.spec.mjs` - full-size/partial optics, pixels, layout, accessibility, interactions and lifecycle coverage.
- `docs/liquid-glass.md`, `docs/glass-full-size-profile.json` - implementation and measured validation.

Historical `glass-scroll-profile.json` describes the superseded compact-only solution and must not be used as evidence for the current compositor.

## Validation

Final browser results and profiling are recorded after the production run. Run with the local frontend at 3001 and the existing research API at 8000:

```powershell
npx --no-install playwright test tests/liquid-glass-scroll.spec.mjs --workers=1 --reporter=line
```

## Practical limits

This is screen-space environment refraction, not ray-traced scene glass. It deliberately samples the actual shared atmospheric/hero background while keeping all research content out of the optical texture. It does not capture or distort arbitrary DOM text behind overlays. At the physical viewport edge sampling clamps to the available environment. Existing 2D translation/scale and scrolling are supported; arbitrary 3D-rotated DOM cards are not part of the application.

Browser testing uses Chromium/ANGLE SwiftShader and mobile viewport/DPR emulation. It does not establish physical GPU/mobile frame rates. GPU timer queries and Safari/iOS hardware testing are not available in this run. Resolution adaptation preserves optical coverage, but unsupported/lost WebGL is explicitly a transparent fallback.
