# Ferrum desktop presentation

The desktop presentation and its new motion system apply at **1101px and above**. The original Ferrum Research artifact is restored as the opening experience. Desktop is the priority for this iteration.

## Design system

`src/app/desktop-product.css` owns the desktop tokens and component styles. The palette uses deep ink backgrounds, solid research surfaces, warm white text, and a restrained mint accent. Manrope is the interface and reading font; Instrument Serif is reserved for display headings and selected figures; JetBrains Mono distinguishes scores, tickers, and secondary data labels.

All fonts are self-hosted. The Instrument Serif and JetBrains Mono WOFF2 files are the exact font subsets previously served by the application, with the original fallback metrics retained in `existing-typefaces.css`. Their licenses and the Manrope license are included in `src/app/fonts/`. Production builds do not request Google Fonts.

Desktop uses shared page headers, gutters, control sizes, table treatments, recommendation cards, and research surfaces. The original mineral artifact, typography, and light material lead into that restrained research interface. Its renderer unmounts after the intro; research pages use live charts and pointer lighting without a continuous WebGL backdrop.

## Motion direction

Desktop scrolling uses the browser's native scroll path. `desktop-motion.tsx` observes the visible route, updates its reading rail, and reveals small content groups as they enter view. Scroll input no longer drives layout scans or synchronizes with a JavaScript scroll engine. GSAP choreographs the separate artifact entrance.

`navigation-motion.css` keeps route feedback in the masthead. A travelling rule gives way to a masthead glint and staggered reveals on the new page. Native React snapshots remain scoped to small category selections. Spring indicators follow active tabs.

Company pages surface four fundamental and two technical charts selected from the available source measures. `plot-transition.tsx` redraws marks on metric, date, series and filter changes while keeping the controls responsive. Chart tooltips use one visual component across custom SVG points and Recharts. Intelligence cards span the available width when a row has a single item.

The artifact supports scroll entry, Skip, Enter, Escape, and a homepage “Replay the artifact” control. Session memory prevents replaying the intro during normal navigation. Deep links open the relevant research directly. Reduced-motion preferences retain the content and controls without animated gating, and the original illustrated mineral remains available when WebGL cannot initialize.

## Behavior

- Desktop route navigation uses real links, including a durable `/#company-universe` destination that waits for the company data before scrolling.
- Company section navigation tracks the current section independently of the decorative effects and uses smooth, offset-aware anchor scrolling.
- Desktop comparison selection is shared across company and comparison pages and survives refreshes in the same tab. It remains limited to three companies. Mobile retains its original selection state behavior.
- Provider implementation details are kept out of the desktop Intelligence controls. Research generation, evidence retrieval, source attribution, AI labeling, and limitations are preserved.
- Desktop API failures expose a readable recovery state and a retry action.

## Validation

Build from `frontend`:

```powershell
node node_modules/next/dist/bin/next build
```

Start the frontend and research API together (the launcher builds when needed):

```powershell
npm.cmd start -- --port 3001
```

Run the desktop regression suite with the frontend and API available:

```powershell
$env:FERRUM_TEST_URL = 'http://127.0.0.1:3001'
node node_modules/@playwright/test/cli.js test tests/desktop-product.spec.mjs --reporter=line
```

The suite covers every main page at 1101px, 1440px, and 1920px, plus navigation, command search, filters, sorting, comparison modes and persistence, category selection, company research, disclosures, and recovery states. `tests/cinematic-motion.spec.mjs` separately tests fresh intro entry, no-WebGL fallback, scroll completion, keyboard exits, replay, reduced motion, rapid switches, and listener cleanup across cached routes. Provider generation calls are not made during validation.

`tests/liquid-glass-scroll.spec.mjs` now explicitly covers the retained mobile optical presentation. Before/after mobile style measurements and desktop screenshots are saved under `../artifacts/desktop-finish/`.
