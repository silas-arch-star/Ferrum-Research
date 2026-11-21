/** Explicit meaning and display rules for the workbook fields used by charts. */
export type FieldMeaning =
  | "time-series"
  | "single-period-financial"
  | "ratio-or-percent"
  | "ranking-or-score"
  | "categorical-signal"
  | "component-score"
  | "narrative"
  | "source-metadata";

export interface MetricVisualSpec {
  field: string;
  label: string;
  group: "Profitability" | "Growth" | "Valuation" | "Leverage" | "Liquidity" | "Cash flow";
  meaning: FieldMeaning;
  unit: "Rs Cr" | "Rs/share" | "%" | "x" | "score / 100";
  multiplier: number;
  precision: number;
  kpi?: boolean;
}

export const fundamentalTrendMetrics: MetricVisualSpec[] = [
  { field: "Revenue From Operations (Rs Cr)", label: "Revenue", group: "Growth", meaning: "time-series", unit: "Rs Cr", multiplier: 1, precision: 0, kpi: true },
  { field: "Operating Profit (Rs Cr)", label: "Operating profit", group: "Profitability", meaning: "time-series", unit: "Rs Cr", multiplier: 1, precision: 0 },
  { field: "Net Profit (Rs Cr)", label: "Net profit", group: "Profitability", meaning: "time-series", unit: "Rs Cr", multiplier: 1, precision: 0, kpi: true },
  { field: "ROCE (reported)", label: "ROCE", group: "Profitability", meaning: "ratio-or-percent", unit: "%", multiplier: 100, precision: 1, kpi: true },
  { field: "Operating Margin (reported)", label: "Operating margin", group: "Profitability", meaning: "ratio-or-percent", unit: "%", multiplier: 100, precision: 1 },
  { field: "Debt/Equity (x, reported)", label: "Debt / equity", group: "Leverage", meaning: "ratio-or-percent", unit: "x", multiplier: 1, precision: 2, kpi: true },
  { field: "Current Ratio (x, reported)", label: "Current ratio", group: "Liquidity", meaning: "ratio-or-percent", unit: "x", multiplier: 1, precision: 2 },
  { field: "Operating Cash Flow (Rs Cr)", label: "Operating cash flow", group: "Cash flow", meaning: "time-series", unit: "Rs Cr", multiplier: 1, precision: 0 },
];

export const fundamentalComponentMetrics = [
  { field: "Profitability Score (0-100)", label: "Profitability" },
  { field: "Growth Score (0-100)", label: "Growth" },
  { field: "Financial Strength Score (0-100)", label: "Financial strength" },
  { field: "Valuation Score (0-100)", label: "Valuation" },
] as const;

export const integratedWeights = { fundamental: 0.6, normalizedTechnical: 0.4 } as const;

/** Display rules for source data that is kept textual rather than charted. */
export const narrativeAndMetadataFields: Record<string, FieldMeaning> = {
  "Trend Classification": "categorical-signal",
  "Concise Integrated Assessment": "narrative",
  "Key Contradictions: Fundamental vs Technical": "narrative",
  "Data Availability & Material Limitations": "source-metadata",
};
