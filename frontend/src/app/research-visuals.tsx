"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  XAxis, YAxis,
} from "recharts";
import ChartLegend from "./chart-legend";
import PlotTransition from "./plot-transition";
import { Tooltip, pointReadout } from "./chart-tooltip";
import { chartColors, scoreHeatGradient, scoreHeatStyle } from "@/lib/chart-colors";
import type { Company, CompanyResearch, WorkbookRow } from "@/lib/api";
import { fundamentalComponentMetrics, fundamentalTrendMetrics, integratedWeights } from "@/lib/visualization";

const scoreField = "Integrated Score = wF x Fundamental + wT x Normalised Technical";
const value = (row: WorkbookRow | null | undefined, field: string) => {
  const item = row?.[field];
  return typeof item === "number" && Number.isFinite(item) ? item : null;
};
const trendRows = (sections: CompanyResearch["sections"] | undefined) =>
  sections?.find((section) => section.sheet === "Five-Year Trends")?.rows
    .filter((row) => typeof row["Fiscal Year"] === "string")
    .sort((a, b) => String(a["Fiscal Year"]).localeCompare(String(b["Fiscal Year"]))) ?? [];
const format = (n: number | null, decimals = 1) => n === null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
const axis = { fill: "#8C8C8C", fontSize: 12, fontFamily: "var(--font-mono)" };

export function KPIOverview({ sections }: { sections: CompanyResearch["sections"] | undefined }) {
  const rows = trendRows(sections);
  const latest = rows.at(-1);
  if (!latest) return <div className="chart-state compact"><b>NO MULTI-PERIOD DATA</b><span>Annual metric observations are unavailable in the supplied workbook.</span></div>;
  const metrics = fundamentalTrendMetrics.filter((metric) => metric.kpi).slice(0, 4);
  return <div className="visual-kpi-grid" aria-label={`Fundamental KPIs, ${latest["Fiscal Year"]}`}>
    {metrics.map((metric) => {
      const n = value(latest, metric.field);
      return <article className="visual-kpi" key={metric.field}><span>{metric.label}</span><strong>{format(n === null ? null : n * metric.multiplier, metric.precision)}</strong><small>{metric.unit} · {latest["Fiscal Year"]}</small></article>;
    })}
  </div>;
}

export function FinancialTrendChart({ sections }: { sections: CompanyResearch["sections"] | undefined }) {
  const rows = trendRows(sections);
  const [field, setField] = useState(fundamentalTrendMetrics[0].field);
  const metric = fundamentalTrendMetrics.find((item) => item.field === field) ?? fundamentalTrendMetrics[0];
  const data = rows.map((row) => ({ period: row["Fiscal Year"], value: value(row, metric.field) === null ? null : value(row, metric.field)! * metric.multiplier }));
  if (rows.length < 2) return <div className="chart-state compact"><b>INSUFFICIENT PERIODS</b><span>No historical trend is drawn from a single observation.</span></div>;
  return <div className="visual-chart-card"><div className="visual-chart-heading"><div><span className="section-marker">ANNUAL SERIES · SOURCE OBSERVATIONS</span><h4>{metric.label}</h4><small>{metric.group} · {metric.unit} · {rows[0]["Fiscal Year"]} to {rows.at(-1)?.["Fiscal Year"]}</small></div><label className="visual-select"><span>Metric</span><select value={field} onChange={(event) => setField(event.target.value)}>{fundamentalTrendMetrics.map((item) => <option key={item.field} value={item.field}>{item.label}</option>)}</select></label></div>
    <PlotTransition revision={field}><ResponsiveContainer width="100%" height={285}><LineChart data={data} margin={{ top: 12, right: 18, bottom: 3, left: 4 }}><CartesianGrid vertical={false} stroke="#262626" /><XAxis dataKey="period" tick={axis} tickLine={false} axisLine={{ stroke: "#3A3A3A" }} /><YAxis width={68} tick={axis} tickLine={false} axisLine={false} tickFormatter={(n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: metric.precision })} /><Tooltip formatter={(n) => [`${format(Number(n), metric.precision)} ${metric.unit}`, metric.label]} /><Line dataKey="value" name={metric.label} type="linear" stroke={chartColors.metrics[metric.group]} strokeWidth={2} dot={{ r: 3, fill: chartColors.metrics[metric.group] }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></PlotTransition>
    <ChartLegend items={[{ name: metric.label, color: chartColors.metrics[metric.group] }]} />
  </div>;
}

export function PeerRankingBars({ companies, activeCompany, onOpen }: { companies: Company[]; activeCompany: Company; onOpen: (id: string) => void }) {
  const [field, setField] = useState<string>(fundamentalTrendMetrics.find((item) => item.field === "ROCE (reported)")!.field);
  const metric = fundamentalTrendMetrics.find((item) => item.field === field) ?? fundamentalTrendMetrics[0];
  const peers = companies.filter((company) => company["Peer Group (analyst assumption, fundamental workbook)"] === activeCompany["Peer Group (analyst assumption, fundamental workbook)"])
    .map((company) => { const latest = company.fundamental_trends.at(-1); const raw = value(latest, metric.field); return { id: company.ID, name: company["NSE Symbol (standardised)"], fullName: company["Standardised Company Name"], score: raw === null ? null : raw * metric.multiplier, period: String(latest?.["Fiscal Year"] ?? "") }; })
    .filter((item) => item.score !== null).sort((a, b) => b.score! - a.score!);
  if (!peers.length) return <div className="chart-state compact"><b>PEER SCORES UNAVAILABLE</b></div>;
  return <div className="visual-chart-card"><div className="visual-chart-heading"><div><span className="section-marker">LATEST COMPARABLE SOURCE VALUES</span><h4>{metric.label}</h4><small>{activeCompany["Peer Group (analyst assumption, fundamental workbook)"]} · {metric.unit} · latest available fiscal year</small></div><label className="visual-select"><span>Financial metric</span><select value={field} onChange={(event) => setField(event.target.value)}>{fundamentalTrendMetrics.map((item) => <option key={item.field} value={item.field}>{item.label}</option>)}</select></label></div>
    <PlotTransition revision={field}><ResponsiveContainer width="100%" height={Math.max(180, companies.filter(item => item["Peer Group (analyst assumption, fundamental workbook)"] === activeCompany["Peer Group (analyst assumption, fundamental workbook)"]).length * 42)}><BarChart data={peers} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 12 }} onClick={(state) => { const payload = state as unknown as { activePayload?: { payload?: { id?: unknown } }[] }; const id = payload.activePayload?.[0]?.payload?.id; if (typeof id === "string") onOpen(id); }}><CartesianGrid horizontal={false} stroke="#262626" /><XAxis type="number" domain={["auto", "auto"]} tick={axis} tickLine={false} axisLine={{ stroke: "#3A3A3A" }} /><YAxis type="category" dataKey="name" width={92} tick={axis} tickLine={false} axisLine={false} /><Tooltip formatter={(n) => [`${format(Number(n), metric.precision)} ${metric.unit}`, metric.label]} labelFormatter={(label) => { const peer = peers.find((item) => item.name === label); return `${peer?.fullName ?? label} · ${peer?.period ?? ""}`; }} /><Bar dataKey="score" name={metric.label} fill={chartColors.metrics[metric.group]} activeBar={{ fill: "#c5e9fa" }} barSize={16} isAnimationActive={false} /></BarChart></ResponsiveContainer></PlotTransition>
    <ChartLegend items={[{ name: metric.label, color: chartColors.metrics[metric.group], mark: "bar" }]} /><p className="chart-caption">Underlying ratio and financial figures remain in source workbook units. Missing peer values are omitted.</p>
  </div>;
}

export function ScoreBreakdown({ company, companies, onOpen }: { company: Company; companies: Company[]; onOpen: (id: string) => void }) {
  const integrated = company.integrated_scorecard;
  const f = value(integrated, "Fundamental Score (0-100)");
  const t = value(integrated, "Technical Score Normalised (dispersion-matched)");
  const data = [
    { name: "Fundamental · 60%", color: chartColors.fundamental, contribution: f === null ? null : f * integratedWeights.fundamental },
    { name: "Normalised technical · 40%", color: chartColors.technical, contribution: t === null ? null : t * integratedWeights.normalizedTechnical },
  ].filter((item) => item.contribution !== null);
  const leaderboard = useMemo(() => companies.map((item) => ({ id: item.ID, name: item["NSE Symbol (standardised)"], fullName: item["Standardised Company Name"], score: value(item.integrated_scorecard, scoreField), rank: value(item.integrated_scorecard, "Integrated Rank") }))
    .filter((item) => item.score !== null).sort((a, b) => b.score! - a.score!), [companies]);
  return <div className="integrated-visual-grid"><div className="visual-chart-card"><div className="visual-chart-heading"><div><span className="section-marker">SCORE CONTRIBUTIONS</span><h4>Reported 60:40 blend</h4><small>Integrated score scale / 100</small></div><strong className="integrated-figure">{format(value(integrated, scoreField))}</strong></div>
    <ResponsiveContainer width="100%" height={190}><BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 12 }}><CartesianGrid horizontal={false} stroke="#262626" /><XAxis type="number" domain={[0, 60]} tick={axis} tickLine={false} axisLine={{ stroke: "#3A3A3A" }} /><YAxis type="category" dataKey="name" width={178} tick={axis} tickLine={false} axisLine={false} /><Tooltip formatter={(n) => [`${format(Number(n))} points`, "Weighted contribution"]} /><Bar dataKey="contribution" barSize={18} isAnimationActive={false}>{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>
    <ChartLegend items={data.map(item => ({ name: item.name, color: item.color, mark: "bar" }))} />
    <p className="chart-caption">Actual fundamental score × 0.60 and workbook dispersion-matched technical score × 0.40. Weighted contributions sum to the reported score.</p>
  </div><div className="visual-chart-card"><div className="visual-chart-heading"><div><span className="section-marker">20-COMPANY LEADERBOARD</span><h4>Integrated scorecard</h4><small>Source rank · scale / 100</small></div><strong className="rank-stamp">Rank {format(value(integrated, "Integrated Rank"), 0)}</strong></div><div className="integrated-leaderboard">{leaderboard.map((item, index) => <button key={item.id} className={item.id === company.ID ? "leader-row current" : "leader-row"} onClick={() => onOpen(item.id)}><span>{String(item.rank ?? index + 1).padStart(2, "0")}</span><b>{item.name}</b><i><span style={{ width: `${Math.min(100, Math.max(0, item.score!))}%` }} /></i><strong>{format(item.score)}</strong></button>)}</div><p className="chart-caption">Integrated scorecard rank is distinct from the final Overall Best Investment selection.</p></div></div>;
}

export function ScoreHeatmap({ companies, onOpen }: { companies: Company[]; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>(fundamentalComponentMetrics.map((item) => item.field));
  const rows = useMemo(() => companies.map((company) => ({ company, scores: fundamentalComponentMetrics.map((metric) => value(company.fundamental_scorecard, metric.field)) })), [companies]);
  return <div className="score-heatmap-wrap"><div className="heatmap-controls">{fundamentalComponentMetrics.map((metric) => <label key={metric.field}><input type="checkbox" checked={selected.includes(metric.field)} onChange={() => setSelected((old) => old.includes(metric.field) ? old.filter((field) => field !== metric.field) : [...old, metric.field])} />{metric.label}</label>)}</div><div className="heatmap-legend"><span>0 - Lower score</span><i aria-hidden="true" style={{ backgroundImage: scoreHeatGradient }} /><span>100 - Higher score</span><span>All cells use the fundamental peer-relative score scale / 100.</span></div>{selected.length === 0 ? <p className="chart-state" role="status">Select a metric to show its scores.</p> : <PlotTransition revision={selected.join(",")}><table className="score-heatmap"><thead><tr><th>Company</th>{fundamentalComponentMetrics.filter((metric) => selected.includes(metric.field)).map((metric) => <th key={metric.field}><span className="heatmap-full-label">{metric.label}</span><span className="heatmap-short-label" aria-hidden="true">{metric.label === "Financial strength" ? "Strength" : metric.label === "Profitability" ? "Profit" : metric.label}</span></th>)}</tr></thead><tbody>{rows.map(({ company, scores }) => <tr key={company.ID}><th><button onClick={() => onOpen(company.ID)}><span className="heatmap-full-label">{company["Standardised Company Name"]}</span><small>{company["NSE Symbol (standardised)"]}</small></button></th>{fundamentalComponentMetrics.map((metric, index) => selected.includes(metric.field) ? <td key={metric.field} className={scores[index] === null ? "heatmap-missing" : ""} style={scores[index] === null ? undefined : scoreHeatStyle(scores[index]!)} tabIndex={0} {...pointReadout(company["Standardised Company Name"], [{ name: metric.label, value: scores[index] === null ? "Not reported" : scores[index]!.toFixed(1) + " / 100" }])}>{scores[index] === null ? "—" : scores[index]!.toFixed(1)}</td> : null)}</tr>)}</tbody></table></PlotTransition>}</div>;
}
