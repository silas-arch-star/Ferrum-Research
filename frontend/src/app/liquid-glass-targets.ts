import type { GlassPreset } from "./liquid-glass-presets";

/** Material assignments are deliberately separate from research and chart logic. */
export const GLASS_TARGETS: { selector: string; variant: GlassPreset; priority?: number }[] = [
  { selector: ".topbar-inner", variant: "navigation", priority: 100 },
  { selector: ".module-nav.open", variant: "navigation" },
  { selector: ".command-box,.source-drawer,.category-feature", variant: "editorial", priority: 110 },
  { selector: ".recommendation-result,.company-context,.paper-panel,.method-notes article,.intel-hero", variant: "editorial", priority: 80 },
  { selector: ".hero-data,.comparison-chart,.visual-chart-card,.technical-chart", variant: "data", priority: 85 },
  { selector: ".sector-visual-stage,.sector-visual-inline", variant: "cinematic", priority: 90 },
  { selector: ".universe-search,.comparison-controls,.intel-hub-controls,.intel-controls", variant: "interactive", priority: 85 },
  { selector: ".context-strip", variant: "navigation", priority: 90 },
  { selector: ".model-assessment,.intel-conclusion,.intel-report-head,.intel-monitor", variant: "editorial", priority: 75 },
  { selector: ".coverage-strip,.table-scroll,.assessment-row > div,.visual-kpi,.ranking-columns > div,.compare-table-wrap,.side-by-side,.rank-bars,.score-heatmap-wrap,.source-inventory > section,.data-sheet-scroll", variant: "data" },
  { selector: ".sector-aside .sticky-chart,.sector-factor-index,.method-reference,.method-limitations,.research-columns > div,.bull-bear > div,.risk-detail,.analyst-note,.source-index,.intel-source,.intel-claims article,.intel-empty,.intel-warning", variant: "editorial" },
  { selector: ".category-tabs,.sector-chapter-nav,.comparison-selected,.chart-controls,.heatmap-controls,.data-sheet-toolbar,.intel-buttons,.view-switch", variant: "interactive" },
];
