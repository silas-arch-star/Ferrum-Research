"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import PlotTransition from "./plot-transition";
import ChartLegend from "./chart-legend";
import { Tooltip, pointReadout } from "./chart-tooltip";
import { getCompanyPrices } from "@/lib/api";
import type { Company, PricePoint, ResearchChart, WorkbookRow } from "@/lib/api";
import { fundamentalComponentMetrics, fundamentalTrendMetrics } from "@/lib/visualization";

const companyName = (c: Company) => c["Standardised Company Name"];
const ticker = (c: Company) => c["NSE Symbol (standardised)"];
const read = (row: WorkbookRow | null | undefined, field: string) => {
  const raw = row?.[field];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
};
const scaled = (raw: number | null, multiplier: number) => raw === null ? null : raw * multiplier;
const format = (n: number, precision = 1) => n.toLocaleString("en-IN", { maximumFractionDigits: precision });
const colors = ["#a5d2c6", "#efc28d", "#bbafe7"];
const axis = { fill: "#a0b5b2", fontSize: 12 };
const grid = "#304042";
const series = (companies: Company[]) => companies.map((company, i) => ({ key: company.ID, name: ticker(company), color: colors[i] }));
const integratedScore = "Integrated Score = wF x Fundamental + wT x Normalised Technical";
const yearRows = (c: Company) => c.fundamental_trends.filter(row => typeof row["Fiscal Year"] === "string");

type Reading = { label: string; value: (c: Company) => number | null };
type PlotRow = Record<string, string | number | null> & { label: string };
type Series = { key: string; name: string; color: string };

const scoreRows: Reading[] = [
  { label: "Fundamental", value: c => read(c.fundamental_research, "Final Score") },
  { label: "Technical", value: c => read(c.technical_research, "Total Score (100)") },
  { label: "Integrated", value: c => read(c.integrated_scorecard, integratedScore) },
];
const componentRows: Reading[] = fundamentalComponentMetrics.map(metric => ({
  label: metric.label, value: c => read(c.fundamental_scorecard, metric.field),
}));
const technicalRows: Reading[] = ["3M", "6M", "1Y"].map(period => ({
  label: period, value: c => scaled(read(c.technical_research, `${period} Return`), 100),
}));
const riskRows: Reading[] = [
  { label: "Fundamental", value: c => read(c.integrated_scorecard, "Fundamental Risk Flags (of 6)") },
  { label: "Technical", value: c => read(c.integrated_scorecard, "Technical Risk Flags (of 4)") },
  { label: "Valuation", value: c => read(c.integrated_scorecard, "Valuation Stretch Flag (P/E or P/B)") },
  { label: "Total", value: c => read(c.integrated_scorecard, "Total Risk Flags") },
];
const financialMetrics = [
  ...fundamentalTrendMetrics,
  { field: "Net Debt (Rs Cr)", label: "Net debt", unit: "Rs Cr", multiplier: 1, precision: 0 },
  { field: "Net Margin (reported)", label: "Net margin", unit: "%", multiplier: 100, precision: 1 },
  { field: "Working Capital (Rs Cr)", label: "Working capital", unit: "Rs Cr", multiplier: 1, precision: 0 },
  { field: "Dividend Payout (%)", label: "Dividend payout", unit: "%", multiplier: 100, precision: 1 },
];

function plotRows(companies: Company[], readings: Reading[]): PlotRow[] {
  return readings.map(({ label, value }) => ({ label, ...Object.fromEntries(companies.map(c => [c.ID, value(c)])) }));
}

function annualRows(companies: Company[], metric: typeof financialMetrics[number]): PlotRow[] {
  const byYear = new Map<string, PlotRow>();
  for (const company of companies) {
    for (const row of yearRows(company)) {
      const label = String(row["Fiscal Year"]);
      const entry = byYear.get(label) ?? { label };
      entry[company.ID] = scaled(read(row, metric.field), metric.multiplier);
      byYear.set(label, entry);
    }
  }
  return [...byYear.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function EvidencePlot({ title, detail, unit, data, lines, kind = "bar", domain, control, baseline = 0, wide = false, revision = title, legend = false }: {
  title: string; detail: string; unit: string; data: PlotRow[]; lines: Series[];
  kind?: "bar" | "line" | "area"; domain?: [number, number]; control?: React.ReactNode;
  baseline?: number; wide?: boolean; revision?: string; legend?: boolean;
}) {
  const reduced = useReducedMotion();
  const plot = useRef<HTMLElement>(null);
  const firstView = useInView(plot, { once: true, amount: .12 });
  const assetId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hasData = data.some(row => lines.some(({ key }) => typeof row[key] === "number"));
  return <motion.article ref={plot} data-plot-visible={firstView} className={`visual-chart-card evidence-plot${wide ? " evidence-wide" : ""}`} initial={reduced ? false : { opacity: .5, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .55, ease: [.22, 1, .36, 1] }}>
    <header className="evidence-plot-header">
      <div><h4>{title}</h4><p>{detail}</p></div>
      {control}
    </header>
    {hasData ? <div className="evidence-plot-frame" >
      <PlotTransition revision={revision + ":" + lines.map(line => line.key).join(",")}><ResponsiveContainer width="100%" height={244}>
        <ComposedChart data={data} margin={{ top: 9, right: 36, bottom: 10, left: 0 }} accessibilityLayer>
          <defs>{lines.map(line => <linearGradient key={line.key} id={`${assetId}-${line.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={line.color} stopOpacity={.30} />
            <stop offset="100%" stopColor={line.color} stopOpacity={.025} />
          </linearGradient>)}</defs>
          <CartesianGrid vertical={false} stroke={grid} strokeDasharray="2 5" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: grid }}
            tickFormatter={label => String(label).replace(/^FY /, "")}
            interval={data.length <= 8 ? 0 : "preserveStartEnd"} minTickGap={wide ? 65 : 20} />
          <YAxis width={58} tick={axis} tickLine={false} axisLine={false}
            domain={domain ?? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max) || 1]}
            tickFormatter={n => Math.abs(n) < .00001 ? "0" : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n)} />
          <ReferenceLine y={baseline} stroke="#78918b" strokeOpacity={.55} />
          <Tooltip cursor={{ stroke: "#78918b", fill: "#a5d2c609" }}
            formatter={(n, label) => [typeof n === "number" ? `${format(n, 2)} ${unit}` : "Not reported", label]} />
          {lines.map((line, i) => {
            const props = { dataKey: line.key, name: line.name, isAnimationActive: firstView && !reduced, animationBegin: i * 85, animationDuration: 620 };
            if (kind === "bar") return <Bar key={line.key} {...props} fill={line.color} maxBarSize={27} radius={[3, 3, 0, 0]} />;
            if (kind === "area") return <Area key={line.key} {...props} type="linear" stroke={line.color} strokeWidth={2} fill={`url(#${assetId}-${line.key})`} dot={{ r: 3 }} connectNulls={false} />;
            return <Line key={line.key} {...props} isAnimationActive={false} type="linear" stroke={line.color} strokeWidth={2} dot={data.length < 20 ? { r: 3 } : false} connectNulls={false} />;
          })}
        </ComposedChart>
      </ResponsiveContainer></PlotTransition>
      {legend && <ChartLegend items={[
        ...lines.map(line => ({ ...line, mark: kind })),
        ...(baseline ? [{ name: "Baseline (" + baseline + "×)", color: "#78918b" }] : []),
      ]} />}
    </div> : <p className="chart-state compact">No numeric observations are available for this chart.</p>}
  </motion.article>;
}

export function AutomatedReviewCharts({ charts, revision }: { charts: ResearchChart[]; revision: string }) {
  const overview = charts.every(chart => chart.context);
  return <section className="intel-section automated-exhibits" aria-label="Automated review charts">
    <div className="section-heading"><h2>{overview ? "Company overview" : "Charts for this question"}</h2></div>
    <div className="evidence-grid">{charts.map(chart =>
      <EvidencePlot key={chart.id} title={chart.title} kind={chart.kind} unit={chart.unit} data={chart.rows} legend
        detail={[chart.context && !overview ? "Company context" : "", chart.source, chart.period, chart.unit].filter(Boolean).join(" · ")}
        lines={chart.series.map((line, index) => ({ ...line, color: colors[index % colors.length] }))}
        revision={revision + ":" + chart.id} />
    )}</div>
  </section>;
}

function IndexedPriceComparison({ lines }: { lines: Series[] }) {
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [months, setMonths] = useState(12);
  const cache = useRef(new Map<string, Promise<PricePoint[]>>());
  const ids = lines.map(line => line.key).join(",");
  useEffect(() => {
    let current = true;
    const fetches = ids.split(",").map(async id => {
      let request = cache.current.get(id);
      if (!request) {
        const requests = cache.current;
        request = getCompanyPrices(id).then(result => result.points).catch(error => {
          requests.delete(id);
          throw error;
        });
        requests.set(id, request);
      }
      try { return [id, await request] as const; }
      catch { return [id, []] as const; }
    });
    Promise.all(fetches).then(results => { if (current) setHistory(Object.fromEntries(results)); });
    return () => { current = false; };
  }, [ids]);

  const loading = lines.some(line => !(line.key in history));
  const closeMaps = lines.map(line => new Map((history[line.key] ?? [])
    .filter(point => Number.isFinite(point.close) && point.close > 0)
    .map(point => [point.date.slice(0, 10), point.close])));
  const commonDates = [...(closeMaps[0]?.keys() ?? [])].filter(date => closeMaps.every(map => map.has(date))).sort();
  const end = commonDates.at(-1);
  const cutoff = end ? new Date(end) : null;
  if (cutoff) cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const dates = cutoff ? commonDates.filter(date => new Date(date) >= cutoff) : [];
  const start = dates[0];
  const data = dates.map(date => ({
    label: date,
    ...Object.fromEntries(lines.map((line, index) => [line.key, closeMaps[index].get(date)! / closeMaps[index].get(start)! * 100])),
  }));
  const values = data.flatMap(row => lines.map(line => Number(row[line.key as keyof typeof row])));
  const domain: [number, number] = [Math.floor(Math.min(100, ...values) / 10) * 10, Math.max(110, Math.ceil(Math.max(100, ...values) / 10) * 10)];
  if (loading) return <p className="chart-state compact evidence-wide" role="status">Loading matched closing prices…</p>;
  return <EvidencePlot title="Relative price performance" detail={data.length > 1
    ? `${start} to ${end} · 100 on the first shared trading date. Source closes are not confirmed adjusted.`
    : "The selected companies have no usable shared trading period."}
    unit="index" data={data.length > 1 ? data : []} lines={lines} kind="line" baseline={100} domain={domain} revision={String(months)} wide
    control={<label className="visual-select"><span>Price history</span><select value={months} onChange={event => setMonths(Number(event.target.value))}>
      <option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>1 year</option><option value={36}>3 years</option>
    </select></label>} />;
}

export function SelectedCompanyCharts({ companies }: { companies: Company[] }) {
  const [field, setField] = useState(financialMetrics[0].field);
  const metric = financialMetrics.find(item => item.field === field) ?? financialMetrics[0];
  const lines = series(companies);
  const byYear = useMemo(() => annualRows(companies, metric), [companies, metric]);
  return <div className="selected-company-charts">
    <ul className="evidence-legend" aria-label="Selected company chart legend">
      {companies.map((company, i) => <li key={company.ID}><i style={{ background: lines[i].color }} />{companyName(company)}</li>)}
    </ul>
    <div className="evidence-grid">
      <EvidencePlot title="Score comparison" detail="Fundamental, technical and integrated scores on the same 100-point scale." unit="/ 100" domain={[0, 100]} data={plotRows(companies, scoreRows)} lines={lines} />
      <EvidencePlot title="Fundamental profile" detail="How each company scored on the four fundamental components." unit="/ 100" domain={[0, 100]} data={plotRows(companies, componentRows)} lines={lines} />
      <EvidencePlot title={`${metric.label} over time`} detail={`Matched fiscal years · ${metric.unit}. Missing periods leave gaps.`} unit={metric.unit} data={byYear} lines={lines} kind="line"
        control={<label className="visual-select"><span>Financial metric</span><select value={field} onChange={event => setField(event.target.value)}>
          {financialMetrics.map(item => <option key={item.field} value={item.field}>{item.label}</option>)}
        </select></label>} />
      <EvidencePlot title={`Latest ${metric.label.toLowerCase()}`} detail={`${metric.unit} · ${byYear.at(-1)?.label ?? "No fiscal period"}`} unit={metric.unit}
        data={byYear.length ? [{ ...byYear.at(-1)!, label: byYear.at(-1)!.label }] : []} lines={lines} />
      <EvidencePlot title="Market returns" detail="Source close returns over 3 months, 6 months and 1 year. Observation dates are in the table below." unit="%" data={plotRows(companies, technicalRows)} lines={lines} />
      <EvidencePlot title="Risk flag counts" detail="Flags triggered in each category and in total. The counts are model outputs." unit="flags" data={plotRows(companies, riskRows)} lines={lines} />
      <IndexedPriceComparison lines={lines} />
    </div>
  </div>;
}

const signatures = [
  { title: "Cash generation", fields: ["Operating Cash Flow (Rs Cr)", "Net Profit (Rs Cr)"], names: ["Operating cash flow", "Net profit"], unit: "Rs Cr" },
  { title: "Funding and liquidity", fields: ["Total Borrowings (Rs Cr)", "Cash & Bank Balances (Rs Cr)"], names: ["Total borrowings", "Cash and bank balances"], unit: "Rs Cr" },
  { title: "Operating margins", fields: ["Operating Margin (reported)", "Net Margin (reported)"], names: ["Operating margin", "Net margin"], unit: "%" },
  { title: "Returns on capital", fields: ["ROCE (reported)", "ROE (reported)"], names: ["ROCE", "ROE"], unit: "%" },
  { title: "Working capital", fields: ["Inventories (Rs Cr)", "Trade Receivables (Rs Cr)", "Trade Payables (Rs Cr)"], names: ["Inventory", "Receivables", "Payables"], unit: "Rs Cr" },
  { title: "Cash flow by activity", fields: ["Operating Cash Flow (Rs Cr)", "Investing Cash Flow (Rs Cr)", "Financing Cash Flow (Rs Cr)"], names: ["Operating", "Investing", "Financing"], unit: "Rs Cr" },
  { title: "Revenue and income", fields: ["Revenue From Operations (Rs Cr)", "Total Income (Rs Cr)"], names: ["Operating revenue", "Total income"], unit: "Rs Cr" },
  { title: "Payout and profitability", fields: ["Dividend Payout (%)", "ROE (reported)"], names: ["Dividend payout", "ROE"], unit: "%" },
  { title: "Debt maturity", fields: ["Long-term Borrowings (Rs Cr)", "Short-term Borrowings (Rs Cr)"], names: ["Long-term borrowings", "Short-term borrowings"], unit: "Rs Cr" },
  { title: "Liquidity and leverage", fields: ["Current Ratio (x, reported)", "Debt/Equity (x, reported)"], names: ["Current ratio", "Debt / equity"], unit: "x" },
  { title: "Cost of funding", fields: ["Finance Cost (Rs Cr)", "Operating Profit (Rs Cr)"], names: ["Finance cost", "Operating profit"], unit: "Rs Cr" },
  { title: "Balance-sheet buffer", fields: ["Net Worth (Rs Cr)", "Net Debt (Rs Cr)"], names: ["Net worth", "Net debt"], unit: "Rs Cr" },
];

function percentileDistance(value: number, population: number[]) {
  if (population.length < 4) return 0;
  const below = population.filter(item => item < value).length;
  const equal = population.filter(item => item === value).length;
  return Math.abs((below + equal / 2) / population.length - .5);
}

export function CompanyEvidenceCharts({ company, universe }: { company: Company; universe: Company[] }) {
  const rows = yearRows(company);
  const latestYear = rows.at(-1)?.["Fiscal Year"];
  const latestByCompany = universe.map(item => yearRows(item).find(row => row["Fiscal Year"] === latestYear));
  const ranked = signatures.map(spec => {
    const fields = spec.fields.map((field, i) => ({ field, name: spec.names[i] }))
      .filter(item => rows.filter(row => read(row, item.field) !== null).length >= 2);
    const distances = fields.flatMap(({ field }) => {
      const value = read(rows.at(-1), field);
      const peers = latestByCompany.map(row => read(row, field)).filter((item): item is number => item !== null);
      return value === null ? [] : [percentileDistance(value, peers)];
    });
    return { spec, fields, weight: distances.length ? distances.reduce((sum, n) => sum + n, 0) / distances.length : 0 };
  }).filter(item => item.fields.length >= 2).sort((a, b) => b.weight - a.weight);
  const chosen: typeof ranked = [];
  const usedFields = new Set<string>();
  while (ranked.length && chosen.length < 4) {
    const nextUnique = ranked.findIndex(item => item.fields.some(field => !usedFields.has(field.field)));
    const [next] = ranked.splice(Math.max(0, nextUnique), 1);
    chosen.push(next);
    next.fields.forEach(field => usedFields.add(field.field));
  }

  if (!chosen.length) return null;
  return <section className="company-evidence" aria-label="Company-specific financial charts">
    <div className="evidence-section-intro"><h4>What stands out for {ticker(company)}</h4><p>Selected from the reported measures furthest from the coverage universe’s midpoint for the same fiscal year.</p></div>
    <div className="evidence-grid">{chosen.map(({ spec, fields }, index) => {
      const keys = fields.map((item, i) => ({ key: `metric${i}`, name: item.name, color: colors[i] }));
      const data = rows.map(row => ({ label: String(row["Fiscal Year"]), ...Object.fromEntries(fields.map(({ field }, i) =>
        [keys[i].key, scaled(read(row, field), spec.unit === "%" ? 100 : 1)])) }));
      return <div key={spec.title} className="company-evidence-tile">
        <EvidencePlot legend title={spec.title} detail={`${ticker(company)} · ${spec.unit} · fiscal-year observations`} unit={spec.unit} data={data} lines={keys} kind={index % 2 === 1 ? "line" : spec.unit === "%" ? "area" : "bar"} />
      </div>;
    })}</div>
  </section>;
}

const marketProfiles: { title: string; unit: string; detail: string; readings: Reading[]; baseline?: number }[] = [
  {
    title: "Relative strength by horizon", unit: "pp",
    detail: "Return minus the benchmark, in percentage points. Above zero means outperformance.",
    readings: ["3M", "6M", "1Y"].flatMap(period => ["Nifty 50", "Nifty Metals"].map(benchmark => ({
      label: period + " " + (benchmark === "Nifty 50" ? "N50" : "Metals"),
      value: (c: Company) => scaled(read(c.technical_research, `${period} vs ${benchmark} (pp)`), 100),
    }))),
  },
  {
    title: "Close versus trend lines", unit: "%",
    detail: "Closing price relative to the reported moving averages. Positive values sit above the trend line.",
    readings: [20, 50, 200].map(days => ({ label: `${days} sessions`, value: c => {
      const close = read(c.technical_research, "Close");
      const sma = read(c.technical_research, `SMA ${days}`);
      return close === null || sma === null || sma <= 0 ? null : (close / sma - 1) * 100;
    } })),
  },
  {
    title: "Trading activity", unit: "x", baseline: 1,
    detail: "Volume relative to its reported baseline. The 1× line marks equal activity.",
    readings: [
      { label: "20D vs 50D", value: c => read(c.technical_research, "20D / 50D Volume") },
      { label: "Latest vs 20D", value: c => read(c.technical_research, "Latest Vol / 20D Avg") },
    ],
  },
  {
    title: "Momentum by horizon", unit: "%",
    detail: "Closing-price returns across the short, medium and long term.",
    readings: [{ label: "20 sessions", value: c => scaled(read(c.technical_research, "20D Price Return"), 100) }, ...technicalRows],
  },
  {
    title: "Levels around the close", unit: "%",
    detail: "Reported distance from the 60-session support and resistance levels.",
    readings: [
      { label: "Above support", value: c => scaled(read(c.technical_research, "Close vs Support"), 100) },
      { label: "To resistance", value: c => scaled(read(c.technical_research, "Distance to Resistance"), 100) },
    ],
  },
];

export function CompanyTechnicalEvidence({ company, universe }: { company: Company; universe: Company[] }) {
  const profiles = marketProfiles.map(profile => {
    const available = profile.readings.filter(metric => metric.value(company) !== null);
    const distance = available.reduce((sum, metric) => {
      const peers = universe.map(metric.value).filter((value): value is number => value !== null);
      return sum + percentileDistance(metric.value(company)!, peers);
    }, 0) / Math.max(1, available.length);
    return { profile, available, distance };
  }).filter(item => item.available.length >= 2).sort((a, b) => b.distance - a.distance).slice(0, 2);
  if (!profiles.length) return null;
  const date = company.technical_research?.["Latest Date"];
  return <section className="company-evidence company-market-evidence" aria-label="Company-specific technical charts">
    <div className="evidence-section-intro"><h4>Market signals for {ticker(company)}</h4><p>{typeof date === "string" ? `Source observations as of ${date.slice(0, 10)}.` : "Latest source observations."}</p></div>
    <div className="evidence-grid">{profiles.map(({ profile, available }, index) =>
      <EvidencePlot key={profile.title} title={profile.title} detail={profile.detail} unit={profile.unit}
        legend data={plotRows([company], available)} lines={[{ key: company.ID, name: profile.title, color: colors[index] }]} baseline={profile.baseline} />,
    )}</div>
  </section>;
}

export function CompanyMarketRange({ company }: { company: Company }) {
  const observed = company.technical_research;
  const low = read(observed, "52W Low (250D)");
  const high = read(observed, "52W High (250D)");
  const close = read(observed, "Close");
  const reduced = useReducedMotion();
  if (low === null || high === null || close === null || high <= low || close < low || close > high) return null;
  const fraction = (close - low) / (high - low);
  return <article className="visual-chart-card evidence-range">
    <header className="evidence-plot-header"><div><h4>Position in the 52-week range</h4><p>{ticker(company)} · source close and reported 250-session low/high</p></div><strong>₹{format(close, 2)}</strong></header>
    <div className="range-track" role="img" tabIndex={0} aria-label={`₹${format(close, 2)} close, ${Math.round(fraction * 100)} percent of the way from low to high`}
      {...pointReadout(ticker(company) + " · 52-week range", [
        { name: "Close", value: "₹" + format(close, 2) }, { name: "Low", value: "₹" + format(low, 2) }, { name: "High", value: "₹" + format(high, 2) },
      ])}>
      <motion.span initial={reduced ? false : { scaleX: 0 }} whileInView={{ scaleX: fraction }} viewport={{ once: true }} transition={{ duration: .9, ease: [.22, 1, .36, 1] }} />
    </div>
    <div className="range-ends"><span>Low · ₹{format(low, 2)}</span><span>High · ₹{format(high, 2)}</span></div>
    <ChartLegend items={[{ name: "Low to last close", color: "#a5d2c6", mark: "bar" }, { name: "Last close to high", color: "#304646", mark: "bar" }]} />
  </article>;
}
