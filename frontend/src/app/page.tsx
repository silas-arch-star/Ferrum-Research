"use client";

import { addTransitionType, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { scaleLinear } from "d3-scale";
import { AnimatePresence, motion, useReducedMotion, useScroll } from "framer-motion";
import { Command } from "cmdk";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer,
  XAxis, YAxis,
} from "recharts";
import DailyHistogram from "./daily-histogram";
import ChartLegend from "./chart-legend";
import ChartZoom from "./chart-zoom";
import PlotTransition from "./plot-transition";
import { Tooltip, pointReadout } from "./chart-tooltip";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Command as CommandIcon,
  Menu, Search, ShieldAlert, X,
} from "lucide-react";
import { getCompanies, getCompanyPrices, getCompanyResearch, getRecommendations, getSectorResearch, getSourceInventory } from "@/lib/api";
import type { Company, CompanyResearch, PricePoint, Recommendation, SectorResearch, SourceSheet, WorkbookRow } from "@/lib/api";
import { FinancialTrendChart, KPIOverview, PeerRankingBars, ScoreBreakdown, ScoreHeatmap } from "./research-visuals";
import { CompanyEvidenceCharts, CompanyMarketRange, CompanyTechnicalEvidence, SelectedCompanyCharts } from "./evidence-charts";
import { sheetLabel, sourceLabel } from "@/lib/source-labels";
import { fundamentalComponentMetrics, fundamentalTrendMetrics } from "@/lib/visualization";
import { CompanyIntelligence, IntelligenceHub } from "./intelligence";
import HeroNetwork from "./hero-network";
import HeroMotion from "./hero-motion";
import HeroAtmosphere from "./hero-atmosphere";
import EditorialMotion from "./editorial-motion";
import LiquidGlassSurface from "./liquid-glass-surface";
import ApplicationGlass from "./application-glass";
import { companyColor } from "@/lib/chart-colors";
import { useCompactResearch, useDesktopPresentation } from "@/lib/use-desktop-presentation";
import { useComparison } from "@/lib/use-desktop-comparison";
import DesktopMotion from "./desktop-motion";
import { announceNavigation } from "./motion-navigation";

type View = "Overview" | "Compare" | "Rankings" | "Methodology" | "Sector" | "Company" | "Intelligence";
type SortKey = "name" | "fundamental" | "technical" | "integrated" | "risk";
type VisualMetric = "fundamental" | "technical" | "integrated" | "profitability" | "growth" | "financial-strength" | "valuation" | "revenue" | "net-profit" | "roce" | "debt-equity" | "current-ratio";
type CompanySection = "Verdict" | "Technical" | "Fundamental" | "Integrated" | "Risks" | "Bull vs Bear" | "Peer Comparison" | "Sources" | "Intelligence";

const views: View[] = ["Overview", "Sector", "Compare", "Rankings", "Methodology", "Intelligence"];
const sections: CompanySection[] = ["Verdict", "Fundamental", "Technical", "Integrated", "Risks", "Bull vs Bear", "Peer Comparison", "Intelligence", "Sources"];
const categories = ["Income", "High-Growth", "Defensive / Safe-Haven", "Value", "Momentum", "ESG-Oriented", "Overall Best Investment"];
const cell = (row: WorkbookRow | null | undefined, key: string): string | number | null => row?.[key] ?? null;
const number = (value: string | number | null | undefined): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const score = (row: WorkbookRow | null | undefined, key: string) => number(cell(row, key));
const asText = (value: string | number | null | undefined, fallback = "Not reported") => (typeof value === "string" || typeof value === "number") && String(value).trim() ? String(value) : fallback;
const formatScore = (value: number | null) => value === null ? "—" : value.toFixed(1);
const asOfDate = (value: string | number | null | undefined) => typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "Date not reported";
const integratedKey = "Integrated Score = wF x Fundamental + wT x Normalised Technical";

function Provenance({ kind, children, className = "" }: { kind: "SRC" | "CALC" | "ANALYST" | "UNVERIFIED" | "STALE"; children: React.ReactNode; className?: string }) {
  return <span className={`provenance-tag provenance-${kind.toLowerCase()} ${className}`}><b>{kind}</b>{children}</span>;
}

function CompanyScatter({ companies, selectedId, onSelect }: { companies: Company[]; selectedId: string; onSelect: (id: string) => void }) {
  const width = 760; const height = 440; const margin = { top: 32, right: 28, bottom: 60, left: 54 };
  const [plotWidth, setPlotWidth] = useState(width);
  const plotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width || width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const fontScale = Math.max(1, width / plotWidth);
  const x = scaleLinear().domain([0, 100]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);
  const compact = useCompactResearch();
  const [hoveredId, setHoveredId] = useState("");
  const [tappedId, setTappedId] = useState("");
  const pickPoint = (id: string) => compact ? setTappedId(id) : onSelect(id);
  const activeId = hoveredId || tappedId || selectedId;
  const active = companies.find((company) => company.ID === activeId);
  const activeX = score(active?.fundamental_research, "Final Score");
  const activeY = score(active?.technical_research, "Total Score (100)");
  const plotted = companies.filter((company) => score(company.fundamental_research, "Final Score") !== null && score(company.technical_research, "Total Score (100)") !== null);
  if (!plotted.length) return <div className="chart-state compact"><b>INSUFFICIENT DATA</b><span>Fundamental and technical scores are unavailable for this scatterplot.</span></div>;
  return <div className="scatter-wrap" ref={plotRef}>
    <svg className="scatterplot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fundamental score versus technical score for companies with reported observations">
      {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="scatter-grid" /><text x={margin.left - 10} y={y(tick) + 4} textAnchor="end" className="scatter-tick" style={{ fontSize: 13 * fontScale }}>{tick}</text><text x={x(tick)} y={y(0) + 12} textAnchor="middle" className="scatter-tick" style={{ fontSize: 13 * fontScale }}>{tick}</text></g>)}
      <text x={margin.left} y={13} className="scatter-axis-title" style={{ fontSize: 13 * fontScale }}>TECHNICAL SCORE</text>
      <text x={width - margin.right} y={height - 1} textAnchor="end" className="scatter-axis-title" style={{ fontSize: 13 * fontScale }}>FUNDAMENTAL SCORE →</text>
      {activeX !== null && activeY !== null && <g key={activeId} className="scatter-guides" aria-hidden="true" pointerEvents="none">
        <path d={`M${x(activeX)},${y(activeY)} H${x(0)}`} pathLength="1" />
        <path d={`M${x(activeX)},${y(activeY)} V${y(0)}`} pathLength="1" />
        <circle cx={x(activeX)} cy={y(activeY)} r={12 * fontScale} />
      </g>}
      {companies.map((company, index) => {
        const fundamental = score(company.fundamental_research, "Final Score");
        const technical = score(company.technical_research, "Total Score (100)");
        if (fundamental === null || technical === null) return null;
        const isActive = company.ID === activeId;
        return <g key={company.ID} {...pointReadout(company["Standardised Company Name"], [
          { name: "Fundamental", value: fundamental.toFixed(1) + " / 100" },
          { name: "Technical", value: technical.toFixed(1) + " / 100" },
        ])} className={hoveredId ? company.ID === hoveredId ? "scatter-point active" : "scatter-point dimmed" : "scatter-point"} style={{ animationDelay: `${index * 18}ms` }} role="button" tabIndex={0} aria-label={`${company["NSE Symbol (standardised)"]}: fundamental ${fundamental.toFixed(1)}, technical ${technical.toFixed(1)}`} onMouseEnter={() => { if (!compact) setHoveredId(company.ID); }} onMouseLeave={() => setHoveredId("")} onFocus={() => { if (!compact) setHoveredId(company.ID); }} onBlur={() => setHoveredId("")} onClick={() => pickPoint(company.ID)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickPoint(company.ID); } }}>
          {compact && <circle cx={x(fundamental)} cy={y(technical)} r={11 * fontScale} fill="transparent" />}
          <circle cx={x(fundamental)} cy={y(technical)} r={(isActive ? 7 : 4.5) * fontScale} className={isActive ? "point selected" : "point"} />
          {isActive && <text x={x(fundamental) + 11 * fontScale} y={y(technical) - 9 * fontScale} className="scatter-label" style={{ fontSize: 13 * fontScale }}>{company["NSE Symbol (standardised)"]}</text>}
          
        </g>;
      })}
    </svg>
    <div className="scatter-caption"><span><b>{active?.["NSE Symbol (standardised)"] ?? `${plotted.length} STOCKS`}</b>{active ? ` · ${active["Standardised Company Name"]}` : " · company scores"}</span><span>Selected point · source observations</span></div>
    {compact && active && <div className="mobile-scatter-reading">
      <span>Fundamental <b>{formatScore(activeX)}</b></span><span>Technical <b>{formatScore(activeY)}</b></span>
      <button type="button" onClick={() => onSelect(active.ID)}>Open research <ChevronRight size={15} aria-hidden="true" /></button>
    </div>}
  </div>;
}

const PriceCharts = memo(function PriceCharts({ points, loading, error }: { points: PricePoint[]; loading: boolean; error: string }) {
  const desktop = useDesktopPresentation();
  const [range, setRange] = useState<"1M" | "6M" | "1Y" | "3Y" | "All">("All");
  const [averages, setAverages] = useState<string[]>(["sma20", "sma50"]);
  if (loading) return <div className="chart-skeleton" aria-label="Loading historical price observations"><span /><span /><span /></div>;
  if (error) return <div className="chart-state"><b>DATA UNAVAILABLE</b><span>{error}</span></div>;
  const allPrices = points.filter((point) => number(point.close) !== null);
  const endDate = new Date(allPrices.at(-1)?.date ?? "");
  const cutoff = new Date(endDate);
  const months = range === "1M" ? 1 : range === "6M" ? 6 : range === "1Y" ? 12 : range === "3Y" ? 36 : 0;
  if (months) cutoff.setMonth(cutoff.getMonth() - months);
  const prices = range === "All" ? allPrices : allPrices.filter((point) => new Date(point.date) >= cutoff);
  const firstVisibleDate = prices[0]?.date;
  const rsi = points.filter((point) => number(point.rsi) !== null && (!firstVisibleDate || point.date >= firstVisibleDate));
  const volumes = points.filter((point) => number(point.volume) !== null && (!firstVisibleDate || point.date >= firstVisibleDate));
  const macd = points.filter((point) => number(point.macd) !== null && (!firstVisibleDate || point.date >= firstVisibleDate));
  const averageLines = [{ field: "sma20", label: "20-day SMA", color: "#7E9DB8" }, { field: "sma50", label: "50-day SMA", color: "#D9A94A" }, { field: "sma200", label: "200-day SMA", color: "#9A86B8" }];
  if (prices.length < 2) return <div className="chart-state"><b>INSUFFICIENT DATA</b><span>No usable daily closing-price observations were supplied for this company.</span></div>;
  const firstDate = asOfDate(prices[0].date); const latestDate = asOfDate(prices[prices.length - 1].date);
  const dateTick = (count: number) => (value: string) => count <= 65 ? value.slice(5, 10) : value.slice(0, 7);
  const axis = { fill: "#8C8C8C", fontSize: 13, fontFamily: "var(--font-mono)" };
  const previousCloseByDate = new Map<string, number>();
  let previousClose: number | null = null;
  points.forEach((point) => {
    if (previousClose !== null) previousCloseByDate.set(point.date, previousClose);
    previousClose = point.close;
  });
  const sortedVolumes = volumes.flatMap((point) => point.volume === null ? [] : [point.volume]).sort((a, b) => a - b);
  const highVolumeThreshold = sortedVolumes[Math.min(sortedVolumes.length - 1, Math.floor(sortedVolumes.length * 0.9))] ?? Infinity;
  const volumeWindow: number[] = [];
  const directionalVolumes = volumes.map((point) => {
    const previous = previousCloseByDate.get(point.date);
    if (point.volume !== null) volumeWindow.push(point.volume);
    if (volumeWindow.length > 20) volumeWindow.shift();
    const volumeAverage = volumeWindow.length === 20 ? volumeWindow.reduce((sum, volume) => sum + volume, 0) / 20 : null;
    return { ...point, direction: previous === undefined ? 0 : point.close >= previous ? 1 : -1, highVolume: point.volume !== null && point.volume >= highVolumeThreshold, volumeAverage };
  });
  const shadedPrices = prices.map((point, index) => {
    const previous = index > 0 ? prices[index - 1].close : null;
    const next = index + 1 < prices.length ? prices[index + 1].close : null;
    return { ...point, risingClose: (previous !== null && point.close >= previous) || (next !== null && next >= point.close) ? point.close : null, fallingClose: (previous !== null && point.close < previous) || (next !== null && next < point.close) ? point.close : null };
  });
  return <div className="charts-stack"><div className="range-control" role="group" aria-label="Price chart date range">{(["1M", "6M", "1Y", "3Y", "All"] as const).map((item) => <button key={item} aria-pressed={range === item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}<span>{asOfDate(prices[0]?.date)} to {asOfDate(prices.at(-1)?.date)}</span></div>
    <div className="average-control" role="group" aria-label="Moving average overlays">{averageLines.map((item) => <label key={item.field}><input type="checkbox" checked={averages.includes(item.field)} onChange={() => setAverages((old) => old.includes(item.field) ? old.filter((field) => field !== item.field) : [...old, item.field])} /><span style={{ borderColor: item.color }}>{item.label}</span></label>)}</div>
    <div className="chart-block technical-chart"><div className="chart-title"><strong>Price &amp; Moving Averages</strong><span>INR per share · source close</span></div><ChartZoom label="Price and moving averages" range={range} rows={shadedPrices}>{visible => <PlotTransition revision={range + ":" + averages.join(",")}><ResponsiveContainer width="100%" height={desktop === false ? 268 : 480}><ComposedChart data={visible} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
      <defs><linearGradient id="price-rise-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#26A69A" stopOpacity={0.2} /><stop offset="100%" stopColor="#26A69A" stopOpacity={0.01} /></linearGradient><linearGradient id="price-fall-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF5350" stopOpacity={0.18} /><stop offset="100%" stopColor="#EF5350" stopOpacity={0.01} /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#292929" /><XAxis dataKey="date" tickFormatter={dateTick(visible.length)} minTickGap={38} tick={axis} axisLine={{ stroke: "#3A3A3A" }} tickLine={false} /><YAxis domain={["auto", "auto"]} width={desktop === false ? 49 : 68} tick={axis} axisLine={false} tickLine={false} tickFormatter={(value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 0 })} /><Tooltip labelFormatter={(label) => asOfDate(String(label))} formatter={(value, name) => ["INR " + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 }), String(name)]} cursor={{ stroke: "#8C8C8C", strokeDasharray: "3 3" }} /><Area dataKey="risingClose" name="Rising price area" stroke="none" fill="url(#price-rise-fill)" tooltipType="none" isAnimationActive={false} legendType="none" /><Area dataKey="fallingClose" name="Falling price area" stroke="none" fill="url(#price-fall-fill)" tooltipType="none" isAnimationActive={false} legendType="none" /><Line type="linear" dataKey="close" name="Close" stroke="#F5F4F0" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: "#F5F4F0", stroke: "#0A0A0A", strokeWidth: 1 }} isAnimationActive={false} />{averageLines.filter((item) => averages.includes(item.field)).map((item) => <Line key={item.field} type="linear" dataKey={item.field} name={item.label} stroke={item.color} strokeWidth={1} dot={false} connectNulls={false} isAnimationActive={false} />)}
    </ComposedChart></ResponsiveContainer></PlotTransition>}</ChartZoom>
      <ChartLegend items={[
        { name: "Close", color: "#F5F4F0" },
        ...averageLines.filter(item => averages.includes(item.field)).map(item => ({ name: item.label, color: item.color })),
        { name: "Flat or rising price", color: "#26A69A", mark: "area" },
        { name: "Falling price", color: "#EF5350", mark: "area" },
      ]} /></div>
    <div className="chart-block technical-chart"><div className="chart-title"><strong>RSI (14)</strong><span>{rsi.length ? rsi.length.toLocaleString() + " observations · index 0 to 100" : "Not available"}</span></div>{rsi.length > 1 ? <ChartZoom label="RSI" range={range} rows={rsi}>{visible => <PlotTransition revision={range}><ResponsiveContainer width="100%" height={desktop === false ? 268 : 480}><ComposedChart data={visible} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="#292929" /><ReferenceArea y1={0} y2={30} fill="#26A69A" fillOpacity={0.09} /><ReferenceArea y1={30} y2={70} fill="#8C8C8C" fillOpacity={0.035} /><ReferenceArea y1={70} y2={100} fill="#EF5350" fillOpacity={0.09} /><XAxis dataKey="date" tickFormatter={dateTick(visible.length)} minTickGap={38} tick={axis} axisLine={{ stroke: "#3A3A3A" }} tickLine={false} /><YAxis domain={[0, 100]} width={desktop === false ? 49 : 68} tick={axis} axisLine={false} tickLine={false} ticks={[0, 30, 50, 70, 100]} /><ReferenceLine y={70} stroke="#EF5350" strokeOpacity={0.7} strokeDasharray="4 4" /><ReferenceLine y={30} stroke="#26A69A" strokeOpacity={0.7} strokeDasharray="4 4" /><Tooltip labelFormatter={(label) => asOfDate(String(label))} formatter={(value) => [Number(value).toFixed(1) + " index", "RSI (14)"]} cursor={{ stroke: "#8C8C8C", strokeDasharray: "3 3" }} /><Area dataKey="rsi" name="RSI shaded area" stroke="none" fill="#FFB74D" fillOpacity={0.1} tooltipType="none" isAnimationActive={false} legendType="none" /><Line type="linear" dataKey="rsi" name="RSI (14)" stroke="#FFB74D" strokeWidth={1.8} dot={false} connectNulls={false} activeDot={{ r: 4, fill: "#FFB74D", stroke: "#0A0A0A" }} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></PlotTransition>}</ChartZoom> : <div className="chart-state compact"><b>INSUFFICIENT DATA</b><span>RSI is not available for the selected dates.</span></div>}
      {rsi.length > 1 && <ChartLegend items={[
        { name: "14-session RSI", color: "#FFB74D", mark: "line" },
        { name: "Oversold threshold (30)", color: "#26A69A", mark: "dash" },
        { name: "Neutral zone (30 to 70)", color: "#8C8C8C", mark: "area" },
        { name: "Overbought threshold (70)", color: "#EF5350", mark: "dash" },
      ]} />}</div>
    <div className="chart-block technical-chart"><div className="chart-title"><strong>Daily Volume</strong><span>{volumes.length ? "Source volume · shares per session; upper decile highlighted" : "Not available"}</span></div>{volumes.length > 1 ? <ChartZoom label="Daily volume" range={range} rows={directionalVolumes}>{visible => <PlotTransition revision={range}><ResponsiveContainer width="100%" height={desktop === false ? 268 : 480}><ComposedChart data={visible} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}><defs><linearGradient id="volume-up-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#26A69A" stopOpacity={0.78} /><stop offset="100%" stopColor="#26A69A" stopOpacity={0.28} /></linearGradient><linearGradient id="volume-down-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF5350" stopOpacity={0.76} /><stop offset="100%" stopColor="#EF5350" stopOpacity={0.28} /></linearGradient><linearGradient id="volume-average-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D9A94A" stopOpacity={0.12} /><stop offset="100%" stopColor="#D9A94A" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#292929" /><XAxis scale="band" dataKey="date" tickFormatter={dateTick(visible.length)} minTickGap={38} tick={axis} axisLine={{ stroke: "#3A3A3A" }} tickLine={false} /><YAxis width={desktop === false ? 46 : 68} tick={axis} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(value)} /><Tooltip labelFormatter={(label) => asOfDate(String(label))} formatter={(value, name, item) => [new Intl.NumberFormat("en-IN").format(Number(value)) + " shares", String(name).includes("average") ? "20-session volume average" : (item.payload.direction > 0 ? "Volume - price up" : item.payload.direction < 0 ? "Volume - price down" : "Volume - direction unavailable") + (item.payload.highVolume ? " - high-volume session" : "")]} cursor={{ fill: "#8C8C8C", fillOpacity: 0.12 }} /><Area dataKey="volumeAverage" name="20-session volume average shaded area" stroke="none" fill="url(#volume-average-fill)" fillOpacity={0.6} tooltipType="none" isAnimationActive={false} legendType="none" /><DailyHistogram rows={visible} field="volume" name="Daily volume" /><Line dataKey="volumeAverage" name="20-session volume average" stroke="#D9A94A" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></PlotTransition>}</ChartZoom> : <div className="chart-state compact"><b>INSUFFICIENT DATA</b><span>Volume is not available for the selected dates.</span></div>}
      {volumes.length > 1 && <ChartLegend items={[
        { name: "Higher or unchanged close", color: "#26A69A", mark: "bar" },
        { name: "Lower close", color: "#EF5350", mark: "bar" },
        { name: "No previous close", color: "#777777", mark: "bar" },
        { name: "20-session volume average", color: "#D9A94A", mark: "line" },
      ]} />}</div>
    <div className="chart-block technical-chart"><div className="chart-title"><strong>MACD</strong><span>{macd.length.toLocaleString()} aligned observations</span></div>{macd.length > 1 ? <ChartZoom label="MACD" range={range} rows={macd}>{visible => {
      const macdExtent = visible.reduce((extent, point) => ({ min: Math.min(extent.min, point.macd ?? 0, point.macd_signal ?? 0, point.macd_histogram ?? 0), max: Math.max(extent.max, point.macd ?? 0, point.macd_signal ?? 0, point.macd_histogram ?? 0) }), { min: 0, max: 0 });
      return <PlotTransition revision={range}><ResponsiveContainer width="100%" height={desktop === false ? 268 : 480}><ComposedChart data={visible} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}><defs><linearGradient id="macd-positive-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#26A69A" stopOpacity={0.76} /><stop offset="100%" stopColor="#26A69A" stopOpacity={0.3} /></linearGradient><linearGradient id="macd-negative-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF5350" stopOpacity={0.3} /><stop offset="100%" stopColor="#EF5350" stopOpacity={0.76} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#292929" /><XAxis scale="band" dataKey="date" tickFormatter={dateTick(visible.length)} minTickGap={38} tick={axis} axisLine={{ stroke: "#3A3A3A" }} tickLine={false} /><YAxis width={desktop === false ? 46 : 68} tick={axis} axisLine={false} tickLine={false} /><ReferenceArea y1={0} y2={macdExtent.max} fill="#26A69A" fillOpacity={0.025} /><ReferenceArea y1={macdExtent.min} y2={0} fill="#EF5350" fillOpacity={0.025} /><ReferenceLine y={0} stroke="#8C8C8C" strokeOpacity={0.85} /><Tooltip labelFormatter={(label) => asOfDate(String(label))} formatter={(value, name) => [Number(value).toFixed(2) + " indicator units", String(name)]} cursor={{ stroke: "#8C8C8C", strokeDasharray: "3 3" }} /><DailyHistogram rows={visible} field="macd_histogram" name="MACD histogram" /><Line dataKey="macd" name="MACD line" stroke="#26A69A" strokeWidth={1.8} dot={false} connectNulls={false} activeDot={{ r: 4, fill: "#26A69A", stroke: "#0A0A0A" }} isAnimationActive={false} /><Line dataKey="macd_signal" name="Signal line" stroke="#FF9800" strokeWidth={1.5} dot={false} connectNulls={false} activeDot={{ r: 4, fill: "#FF9800", stroke: "#0A0A0A" }} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></PlotTransition>;
    }}</ChartZoom> : <div className="chart-state compact"><b>INSUFFICIENT DATA</b><span>MACD is not available for the selected dates.</span></div>}
      {macd.length > 1 && <ChartLegend items={[
        { name: "MACD", color: "#26A69A", mark: "line" },
        { name: "Signal", color: "#FF9800", mark: "line" },
        { name: "Positive histogram", color: "#26A69A", mark: "bar" },
        { name: "Negative histogram", color: "#EF5350", mark: "bar" },
        { name: "Zero line", color: "#8C8C8C", mark: "line" },
      ]} />}</div>
    <div className="chart-provenance"><Provenance kind="SRC">Technical analysis · {firstDate} to {latestDate}</Provenance><Provenance kind="UNVERIFIED">Closes are not confirmed as corporate-action adjusted.</Provenance></div>
  </div>;
});

function Score({ value, strong = false }: { value: number | null; strong?: boolean }) {
  return <span className={`score ${strong ? "score-strong" : ""}`}>{formatScore(value)}</span>;
}

function workbookFieldKeys(fields: string[]) {
  const totals = new Map<string, number>();
  for (const field of fields) {
    if (field.trim()) totals.set(field, (totals.get(field) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  return fields.map((field, column) => {
    if (!field.trim()) return `column:${column}`;
    const occurrence = (occurrences.get(field) ?? 0) + 1;
    occurrences.set(field, occurrence);
    return (totals.get(field) ?? 0) > 1 ? `field:${field}:${occurrence}` : `field:${field}`;
  });
}

function workbookRowKeys(rows: WorkbookRow[], fields: string[]) {
  const totals = new Map<string, number>();
  const identities = rows.map((row) => {
    const company = String(row.Company ?? row["Company Name"] ?? row["Standardised Company Name"] ?? "").trim();
    const date = String(row.Date ?? row["Latest Date"] ?? row["Fiscal Year"] ?? row["Holding Date"] ?? "").trim();
    return company || date ? JSON.stringify([company, date]) : JSON.stringify(fields.map((field) => row[field] ?? null));
  });
  for (const identity of identities) totals.set(identity, (totals.get(identity) ?? 0) + 1);
  const occurrences = new Map<string, number>();
  return identities.map((identity) => {
    const occurrence = (occurrences.get(identity) ?? 0) + 1;
    occurrences.set(identity, occurrence);
    return totals.get(identity) === 1 ? `row:${identity}` : `row:${identity}:${occurrence}`;
  });
}

function SourceSheetDisclosure({ section, onSource, clean = false }: { section: CompanyResearch["sections"][number]; onSource?: () => void; clean?: boolean }) {
  const compact = useCompactResearch();
  const [open, setOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [recordIndex, setRecordIndex] = useState(0);
  const lastIndex = Math.max(0, section.rows.length - 1);
  const currentIndex = Math.min(recordIndex, lastIndex);
  const record = section.rows[currentIndex];
  const fieldKeys = useMemo(() => open ? workbookFieldKeys(section.fields) : [], [open, section.fields]);
  const rowKeys = useMemo(() => open && !compact ? workbookRowKeys(section.rows, section.fields) : [], [open, compact, section.rows, section.fields]);
  useEffect(() => {
    if (!sourceOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSourceOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sourceOpen]);
  return <details className="data-sheet" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span>{clean ? sheetLabel(section.sheet) : section.sheet}</span><small>{section.rows.length.toLocaleString()} rows · {section.fields.length} fields</small></summary>
    {open && <>
      <div className="data-sheet-toolbar"><span>{clean ? sourceLabel(section.source) : section.source} · saved workbook values</span><button className="source-button" onClick={() => onSource ? onSource() : setSourceOpen(true)}>Source details</button></div>
      {compact ? record ? <div className="compact-record">
        {lastIndex > 0 && <div className="compact-record-navigation">
          <button type="button" disabled={!currentIndex} onClick={() => setRecordIndex(currentIndex - 1)}>Previous</button>
          <form onSubmit={event => {
            event.preventDefault();
            const requested = Number(new FormData(event.currentTarget).get("record"));
            if (requested >= 1 && requested <= lastIndex + 1) setRecordIndex(requested - 1);
          }}>
            <label>Row <input key={currentIndex} name="record" type="number" inputMode="numeric" min={1} max={lastIndex + 1} defaultValue={currentIndex + 1} required aria-label="Workbook row number" /></label>
            <button type="submit" aria-label={`Go to workbook row, of ${lastIndex + 1}`}>Go</button>
          </form>
          <button type="button" disabled={currentIndex === lastIndex} onClick={() => setRecordIndex(currentIndex + 1)}>Next</button>
          <small aria-live="polite">Row {(currentIndex + 1).toLocaleString()} of {section.rows.length.toLocaleString()}</small>
        </div>}
        <dl>{section.fields.map((field, column) => <div key={fieldKeys[column]}><dt>{field}</dt><dd>{formatCell(record[field])}</dd></div>)}</dl>
      </div> : <p className="chart-state">This sheet has no saved rows.</p> :
        <div className="data-sheet-scroll"><table><thead><tr>{section.fields.map((field, column) => <th key={fieldKeys[column]}>{field}</th>)}</tr></thead><tbody>{section.rows.map((row, rowIndex) => <tr key={rowKeys[rowIndex]}>{section.fields.map((field, column) => <td key={fieldKeys[column]}>{formatCell(row[field])}</td>)}</tr>)}</tbody></table></div>}
    </>}
    {sourceOpen && <div className="source-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSourceOpen(false); }}><aside className="source-drawer" role="dialog" aria-modal="true"><button className="source-close" onClick={() => setSourceOpen(false)} aria-label="Close source details"><X size={20} /></button><span className="section-marker">SOURCE RECORD</span><h3>{clean ? sheetLabel(section.sheet) : section.sheet}</h3><p>{section.source} ? {section.sheet}</p><p>{section.rows.length.toLocaleString()} records ? {section.fields.length} fields. Workbook saved values, not recalculated formulas.</p><p>{section.fields.join(" ? ")}</p></aside></div>}
  </details>;
}

function formatCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-IN", { maximumFractionDigits: 4, useGrouping: false });
  return value;
}

function CompanyPanel({ company, prices, pricesLoading, priceError, compareIds, onCompare, onOpen, research, companies = [], recommendations = [] }: { company: Company; prices: PricePoint[]; pricesLoading: boolean; priceError: string; compareIds: string[]; onCompare: () => void; onOpen: (id: string) => void; research?: CompanyResearch | null; companies?: Company[]; recommendations?: Recommendation[] }) {
  const compact = useCompactResearch();
  const chapterMenu = useRef<HTMLDetailsElement>(null);
  const integrated = company.integrated_scorecard; const fundamental = company.fundamental_research; const fundamentalScores = company.fundamental_scorecard; const technical = company.technical_research;
  const riskCount = number(cell(integrated, "Total Risk Flags"));
  const fundamentals = [
    ["Profitability", "Profitability Score (0-100)"], ["Growth", "Growth Score (0-100)"],
    ["Financial strength", "Financial Strength Score (0-100)"], ["Valuation", "Valuation Score (0-100)"],
  ] as const;
  const [drawer, setDrawer] = useState<CompanyResearch["sections"][number] | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerReturnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!drawer) return;
    drawerReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerCloseRef.current?.focus();
    const handleDrawerKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setDrawer(null); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>(".source-drawer button, .source-drawer a[href], .source-drawer [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleDrawerKeys);
    return () => {
      document.removeEventListener("keydown", handleDrawerKeys);
      if (drawerReturnFocus.current?.isConnected) drawerReturnFocus.current.focus();
    };
  }, [drawer]);
  const initialChapter = useRef<string | null>(null);
  useEffect(() => {
    initialChapter.current = location.hash.startsWith("#company-") ? location.hash.slice(1) : null;
  }, [company.ID]);
  useEffect(() => {
    if (!initialChapter.current || pricesLoading) return;
    const chapter = document.getElementById(initialChapter.current);
    if (chapter && location.hash === "#" + chapter.id) {
      chapter.scrollIntoView({ block: "start", behavior: "instant" });
    }
    initialChapter.current = null;
  }, [company.ID, pricesLoading]);
  const sectionId = (section: CompanySection) => `company-${section.toLowerCase().replaceAll(" ", "-")}`;
  const technicalEvidence = asText(cell(company.technical_insight, "Key Risks / Levels to Watch"));
  const bull = asText(cell(fundamental, "Key Strengths (INTERPRETATION)"));
  const bear = asText(cell(fundamental, "Major Weaknesses & Risks (INTERPRETATION)"));
  const peerCompanies = companies.filter((peer) => peer.ID !== company.ID && peer["Peer Group (analyst assumption, fundamental workbook)"] === company["Peer Group (analyst assumption, fundamental workbook)"]).slice(0, 4);
  const categoryMemberships = recommendations.filter((item) => item["Selected Company (model, eligible only)"] === company["Standardised Company Name"]);
  const fundSections = research?.sections.filter((section) => section.source === "IA - Fundamental Analysis.xlsx") ?? [];
  const techSections = research?.sections.filter((section) => section.source === "IA - Technical Analysis.xlsx") ?? [];
  const integratedSections = research?.sections.filter((section) => section.source === "IA - Integrated Analysis.xlsx") ?? [];
  return <article className="company-panel">
    <header className="company-context" id={sectionId("Verdict")}><div><p className="eyebrow">{company.ID} · {company["NSE Symbol (standardised)"]}</p><h2>{company["Standardised Company Name"]}</h2><p>{company["Subsector (analyst assumption, fundamental workbook)"]} · {company["Peer Group (analyst assumption, fundamental workbook)"]}</p></div><button className="compare-action" onClick={onCompare}>{compareIds.includes(company.ID) ? "Remove from comparison" : "Add to comparison"}</button></header>
    {compact ? <details ref={chapterMenu} className="context-strip company-chapter-menu">
      <summary>Jump to a chapter</summary>
      <nav aria-label="Company chapters">{sections.map(section => <a key={section} href={`#${sectionId(section)}`} onClick={() => {
        if (chapterMenu.current) chapterMenu.current.open = false;
      }}>{section}</a>)}</nav>
    </details> : <div className="context-strip"><span>COMPANY RESEARCH</span>{sections.map((section) => <a key={section} href={`#${sectionId(section)}`}>{section}</a>)}</div>}
    <section className="assessment-row"><div><span>Fundamental</span><strong>{formatScore(score(fundamental, "Final Score"))}</strong><small>Rank {asText(cell(fundamental, "Overall Rank"))} · source scale / 100</small></div><div><span>Technical</span><strong>{formatScore(score(technical, "Total Score (100)"))}</strong><small>Rank {asText(cell(technical, "Rank"))} · source scale / 100</small></div><div><span>Integrated</span><strong>{formatScore(score(integrated, integratedKey))}</strong><small>Rank {asText(cell(integrated, "Integrated Rank"))} · source scale / 100</small></div></section>
    <div className="company-categories">{categoryMemberships.length ? categoryMemberships.map((item) => <span key={item.Category}>{item.Category.replace(/^\d+\.\s*/, "")}</span>) : <span>No category model selection reported for this company.</span>}</div>
    <p className="fact-copy verdict-copy">{asText(cell(integrated, "Concise Integrated Assessment"))}</p>
    <p className="model-assessment"><span>RISK-ADJUSTED ASSESSMENT</span><strong>{asText(cell(integrated, "Risk-Adjusted Integrated Assessment"))}</strong><small>{riskCount === null ? "Risk flag count not reported" : `${riskCount} model risk flags`} · Score is a model output, not a probability.</small></p>
    <section className="company-section" id={sectionId("Technical")}><div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 02 — </span>PRICE &amp; TECHNICAL</span><h3>Market structure</h3></div><Provenance kind="SRC">Technical analysis · {asOfDate(cell(technical, "Latest Date"))}</Provenance></div>
      <div className="technical-strip"><span><b>{asText(cell(technical, "Trend Classification"))}</b> trend</span><span>RSI {number(cell(technical, "RSI 14"))?.toFixed(1) ?? "—"}</span><span>Close ₹{number(cell(technical, "Close"))?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}</span><span>1Y {number(cell(technical, "1Y Return")) === null ? "—" : `${(number(cell(technical, "1Y Return"))! * 100).toFixed(1)}%`}</span></div>
      <PriceCharts points={prices} loading={pricesLoading} error={priceError} />
      <CompanyMarketRange company={company} />
      <CompanyTechnicalEvidence company={company} universe={companies} />
      <Provenance kind="CALC">RSI, moving averages and return observations use the supplied workbook values and methodology.</Provenance>
    </section>
    <section className="company-section" id={sectionId("Fundamental")}><div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 03 — </span>FUNDAMENTAL</span><h3>Financial profile</h3></div><Provenance kind="SRC">Fundamental analysis · FY 2025–26</Provenance></div>
      <KPIOverview sections={research?.sections} /><FinancialTrendChart sections={research?.sections} /><PeerRankingBars companies={companies} activeCompany={company} onOpen={onOpen} />
      <CompanyEvidenceCharts company={company} universe={companies} />
      {fundamentalScores ? <div className="metric-table"><div className="metric-table-head"><span>PEER-RELATIVE SCORE</span><span>SCORE / 100</span></div>{fundamentals.map(([label, key]) => <div className="metric-table-row" key={key}><span>{label}</span><Score value={score(fundamentalScores, key)} /><span>CALC · workbook score</span></div>)}</div> : <div className="chart-state compact"><b>INSUFFICIENT DATA</b><span>Fundamental category scores were not reported.</span></div>}
      <p className="fact-copy">{asText(cell(fundamental, "Profitability & Growth (FACTS from workbook)"))}</p><p className="fact-copy">{asText(cell(fundamental, "Financial Strength & Cash Flow (FACTS from workbook)"))}</p><p className="fact-copy">{asText(cell(fundamental, "Valuation & Ownership (FACTS from workbook)"))}</p>
      <div className="company-note-grid"><div className="analyst-note"><Provenance kind="ANALYST">Strengths</Provenance><p>{asText(cell(fundamental, "Key Strengths (INTERPRETATION)"))}</p></div><div className="analyst-note caution"><Provenance kind="ANALYST">Weaknesses and counterarguments</Provenance><p>{asText(cell(fundamental, "Major Weaknesses & Risks (INTERPRETATION)"))}</p></div></div>
    </section>
    <section className="company-section" id={sectionId("Integrated")}><div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 04 — </span>INTEGRATED</span><h3>Assessment &amp; risk</h3></div><Provenance kind="SRC">Integrated analysis</Provenance></div>
      <ScoreBreakdown company={company} companies={companies} onOpen={onOpen} /><p className="fact-copy">{asText(cell(integrated, "Concise Integrated Assessment"))}</p><div className="analyst-note caution"><Provenance kind="ANALYST">Contradictions and counterarguments</Provenance><p>{asText(cell(integrated, "Key Contradictions: Fundamental vs Technical"))}</p></div>
      <div className="risk-detail"><ShieldAlert size={16} /><div><b>{riskCount === null ? "RISK FLAGS · NOT REPORTED" : `RISK FLAGS · ${riskCount}`}</b><p>{asText(cell(integrated, "Overall Risk Flags (detail)"))}</p></div></div>
    </section>
    <section className="company-section" id="company-source-notes"><div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 05 — </span>SOURCES</span><h3>Provenance &amp; limitations</h3></div></div>
      <p className="fact-copy">{asText(company["Data Availability & Material Limitations"])}</p><Provenance kind="SRC">Company master and source workbooks supplied with Ferrum.</Provenance><p className="source-method">Excel formula results are read from saved workbook values; openpyxl does not recalculate formulas. Technical closes are not confirmed as corporate-action adjusted.</p>
    </section>
    <section className="company-section" id={sectionId("Risks")}><div className="section-heading"><div><span className="section-marker">RISK EVIDENCE</span><h3>What could break the thesis.</h3></div></div><div className="research-columns"><div><Provenance kind="SRC">Fundamental workbook</Provenance><p className="fact-copy">{bear}</p></div><div><Provenance kind="SRC">Technical workbook</Provenance><p className="fact-copy">{technicalEvidence}</p></div><div><Provenance kind="SRC">Data coverage</Provenance><p className="fact-copy">{asText(company["Data Availability & Material Limitations"])}</p></div></div></section>
    <section className="company-section" id={sectionId("Bull vs Bear")}><div className="section-heading"><div><span className="section-marker">EVIDENCE IN TENSION</span><h3>Bull case / bear case</h3></div></div><div className="bull-bear"><div><span>SUPPORTING ARGUMENT · ANALYST INTERPRETATION</span><p>{bull}</p></div><div><span>COUNTERARGUMENT · ANALYST INTERPRETATION</span><p>{bear}</p></div></div></section>
    <section className="company-section" id={sectionId("Peer Comparison")}><div className="section-heading"><div><span className="section-marker">PEER COMPARISON</span><h3>Relative position within {company["Peer Group (analyst assumption, fundamental workbook)"]}.</h3></div></div>{peerCompanies.length ? <div className="peer-list">{[company, ...peerCompanies].map((peer) => <div className="peer-row" key={peer.ID}><strong>{peer["Standardised Company Name"]}</strong><span>Fundamental <b>{formatScore(score(peer.fundamental_research, "Final Score"))}</b></span><span>Technical <b>{formatScore(score(peer.technical_research, "Total Score (100)"))}</b></span><span>Integrated rank <b>{formatCell(cell(peer.integrated_scorecard, "Integrated Rank"))}</b></span></div>)}</div> : <p className="chart-state">No comparable peer group is recorded for this company.</p>}</section>
    <CompanyIntelligence key={company.ID} company={company} />
    <section className="company-section" id={sectionId("Sources")}>
      <div className="section-heading"><div><span className="section-marker">SOURCES AND METHODOLOGY</span><h3>Source records</h3></div></div>
      {research ? <div className="source-archive">
        {([
          ["Fundamental analysis", fundSections],
          ["Technical analysis", techSections],
          ["Integrated analysis", integratedSections],
        ] as const).map(([label, records]) => records.length > 0 && <details className="source-archive-group" key={label}>
          <summary>{label}<small>{records.length} source sheets</small></summary>
          <div className="data-explorer">{records.map(section => <SourceSheetDisclosure key={section.sheet} section={section} clean onSource={() => setDrawer(section)} />)}</div>
        </details>)}
      </div>
      : <div className="chart-state compact"><b>LOADING SOURCE RECORDS</b><span>Reading the mapped workbook sheets.</span></div>}
      <p className="source-method">Original workbook locations are available inside each source record. Blank cells indicate missing observations.</p>
    </section>
    {drawer && <div className="source-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawer(null); }}><aside className="source-drawer" role="dialog" aria-modal="true" aria-labelledby="source-title"><button ref={drawerCloseRef} className="source-close" onClick={() => setDrawer(null)} aria-label="Close source details"><X size={20} /></button><span className="section-marker">SOURCE RECORD</span><h3 id="source-title">{sheetLabel(drawer.sheet)}</h3><p>{drawer.source} · {drawer.sheet}</p><p>{drawer.rows.length.toLocaleString()} matched rows · {drawer.fields.length} source fields. Values are read from workbook saved cells; Excel formulas are not recalculated.</p><p className="source-method">Blank cells remain blank. Dates and units are preserved as supplied.</p><button className="compare-action" onClick={() => setDrawer(null)}>Close source</button></aside></div>}
  </article>;
}

function MobileScrollProgress() {
  const { scrollYProgress } = useScroll();
  return <motion.div className="scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />;
}

const companySortLabels: Record<SortKey, string> = {
  name: "Company name",
  fundamental: "Fundamental score",
  technical: "Technical score",
  integrated: "Integrated score",
  risk: "Risk flags",
};

function CompactCompanyList({ companies, recommendations, onOpen, sort, ascending, onSort, comparison }: {
  companies: Company[];
  recommendations: Recommendation[];
  onOpen: (id: string) => void;
  sort: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
  comparison?: { ids: string[]; onToggle: (id: string) => void };
}) {
  if (!companies.length) return <p className="chart-state" role="status">No companies match the current filters.</p>;
  return <>
    <div className="compact-company-sort">
      <label>Sort by<select value={sort} onChange={event => onSort(event.target.value as SortKey)}>
        {Object.entries(companySortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <button type="button" onClick={() => onSort(sort)} aria-label={`Change sort order. Currently ${ascending ? "ascending" : "descending"}`}>
        {ascending ? <ArrowUp size={16} /> : <ArrowDown size={16} />}{ascending ? "Ascending" : "Descending"}
      </button>
    </div>
    {comparison && <p className="compact-company-hint" role="status">{comparison.ids.length < 3 ? "Select up to three companies to compare." : "Three selected. Remove one to add another."}</p>}
    <ul className="compact-companies">
      {companies.map(company => {
        const name = company["Standardised Company Name"];
        const selected = comparison?.ids.includes(company.ID) ?? false;
        const categoryNames = recommendations
          .filter(item => item["Selected Company (model, eligible only)"] === name)
          .map(item => item.Category.replace(/^\d+\.\s*/, ""));
        const risks = metricValue(company, "risk");
        return <li key={company.ID} className={selected ? "is-selected" : undefined}>
          <button className="compact-company-link" type="button" onClick={() => onOpen(company.ID)}>
            <span>{name}<small>{company["NSE Symbol (standardised)"]}</small></span><ChevronRight size={18} aria-hidden="true" />
          </button>
          <dl className="compact-company-scores">
            <div><dt>Fundamental</dt><dd>{formatScore(metricValue(company, "fundamental"))}</dd></div>
            <div><dt>Technical</dt><dd>{formatScore(metricValue(company, "technical"))}</dd></div>
            <div><dt>Integrated</dt><dd>{formatScore(metricValue(company, "integrated"))}</dd></div>
          </dl>
          <div className="compact-company-actions">
            <details><summary>Company details</summary>
              <dl className="compact-detail-list">
                <div><dt>Peer group</dt><dd>{company["Peer Group (analyst assumption, fundamental workbook)"]}</dd></div>
                <div><dt>Risk flags</dt><dd>{risks ?? "Not reported"}</dd></div>
                <div><dt>Category selections</dt><dd>{categoryNames.join(", ") || "No category selection"}</dd></div>
                <div><dt>Classification</dt><dd>{asText(cell(company.integrated_scorecard, "Risk-Adjusted Integrated Assessment"))}</dd></div>
              </dl>
            </details>
            {comparison && <label className="compact-company-check">
              <input type="checkbox" checked={selected} disabled={!selected && comparison.ids.length >= 3} onChange={() => comparison.onToggle(company.ID)} aria-label={`Select ${name} for comparison`} />
              Compare
            </label>}
          </div>
        </li>;
      })}
    </ul>
  </>;
}

function ComparisonTable({ companies, recommendations, selectedId, onSelect, sort, ascending, onSort }: { companies: Company[]; recommendations: Recommendation[]; selectedId: string; onSelect: (id: string) => void; sort: SortKey; ascending: boolean; onSort: (key: SortKey) => void }) {
  const compact = useCompactResearch();
  if (compact) return <CompactCompanyList companies={companies} recommendations={recommendations} onOpen={onSelect} sort={sort} ascending={ascending} onSort={onSort} />;
  const header = (key: SortKey, label: string) => <button className="sort-button" onClick={() => onSort(key)}>{label}{sort === key ? ascending ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : <ArrowUpDown size={14} />}</button>;
  return <div className="table-scroll"><table className="universe-table"><thead><tr><th className="sticky-company">{header("name", "Company")}</th><th>Peer group</th><th>{header("fundamental", "Fundamental")}</th><th>{header("technical", "Technical")}</th><th>{header("integrated", "Integrated")}</th><th>{header("risk", "Risk flags")}</th><th>Category selections</th><th>Classification</th></tr></thead><tbody>{companies.map((company) => {
    const integrated = company.integrated_scorecard; const risks = number(cell(integrated, "Total Risk Flags")); const rowScore = score(integrated, integratedKey);
    const selections = recommendations.filter((item) => item["Selected Company (model, eligible only)"] === company["Standardised Company Name"]).map((item) => item.Category.replace(/^\d+\.\s*/, ""));
    return <tr key={company.ID} onClick={() => onSelect(company.ID)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(company.ID); } }} tabIndex={0} aria-selected={company.ID === selectedId} className={company.ID === selectedId ? "selected-row" : ""}>
      <td className="sticky-company"><button className="table-company" onClick={event => { event.stopPropagation(); onSelect(company.ID); }}><span>{company["Standardised Company Name"]}<small>{company["NSE Symbol (standardised)"]} · {company.ID}</small></span><ChevronRight size={14} /></button></td>
      <td>{company["Peer Group (analyst assumption, fundamental workbook)"]}</td><td className="numeric"><Score value={score(company.fundamental_research, "Final Score")} /></td><td className="numeric"><Score value={score(company.technical_research, "Total Score (100)")} /></td><td className="numeric"><Score value={rowScore} strong /></td>
      <td>{risks === null ? <span className="missing">Not reported</span> : <span className={`risk-count ${risks >= 5 ? "risk-high" : ""}`}>{risks} flags</span>}</td><td>{selections.length ? selections.join(" · ") : <span className="missing">No category selection</span>}</td><td>{asText(cell(integrated, "Risk-Adjusted Integrated Assessment"))}</td>
    </tr>;
  })}</tbody></table></div>;
}

function SideBySideComparison({ companies, recommendations, onRemove }: { companies: Company[]; recommendations: Recommendation[]; onRemove: (id: string) => void }) {
  const compact = useCompactResearch();
  const [measureIndex, setMeasureIndex] = useState(0);
  if (companies.length < 2) return null;
  const selectedCategories = (company: Company) => recommendations.filter((item) => item["Selected Company (model, eligible only)"] === company["Standardised Company Name"]).map((item) => item.Category.replace(/^\d+\.\s*/, "")).join(" · ") || "No category selection";
  const annualMetric = (company: Company, field: string, multiplier = 1, precision = 1) => {
    const raw = number(cell(company.fundamental_trends.at(-1), field));
    return raw === null ? "—" : (raw * multiplier).toLocaleString("en-IN", { maximumFractionDigits: precision, minimumFractionDigits: precision });
  };
  const rows: { label: string; value: (company: Company) => string }[] = [
    { label: "Fundamental score", value: (company) => formatScore(score(company.fundamental_research, "Final Score")) },
    ...fundamentalComponentMetrics.map((metric) => ({ label: `${metric.label} score`, value: (company: Company) => formatScore(score(company.fundamental_scorecard, metric.field)) })),
    { label: "Revenue from operations · Rs Cr", value: (company) => annualMetric(company, fundamentalTrendMetrics[0].field, 1, 0) },
    { label: "Net profit · Rs Cr", value: (company) => annualMetric(company, fundamentalTrendMetrics[2].field, 1, 0) },
    { label: "ROCE · %", value: (company) => annualMetric(company, fundamentalTrendMetrics[3].field, 100) },
    { label: "Debt / equity · x", value: (company) => annualMetric(company, fundamentalTrendMetrics[5].field, 1, 2) },
    { label: "Current ratio · x", value: (company) => annualMetric(company, fundamentalTrendMetrics[6].field, 1, 2) },
    { label: "Fundamental period", value: (company) => asText(cell(company.fundamental_trends.at(-1), "Fiscal Year")) },
    { label: "Technical score", value: (company) => formatScore(score(company.technical_research, "Total Score (100)")) },
    { label: "Technical score as of", value: (company) => asOfDate(cell(company.technical_research, "Latest Date")) },
    { label: "Integrated score", value: (company) => formatScore(score(company.integrated_scorecard, integratedKey)) },
    { label: "Integrated rank", value: (company) => asText(cell(company.integrated_scorecard, "Integrated Rank")) },
    { label: "Risk flags", value: (company) => asText(cell(company.integrated_scorecard, "Total Risk Flags")) },
    { label: "Category selections", value: selectedCategories },
    { label: "Key counterargument", value: (company) => asText(cell(company.integrated_scorecard, "Key Contradictions: Fundamental vs Technical")) },
  ];
  return <section className="side-by-side" id="selected-comparison">
    <div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 03 — </span>SELECTED COMPARISON</span><h2>Evidence, side by side.</h2></div><span>{companies.length} companies · source workbook values</span></div>
    {compact && <div className="compact-comparison">
      <label>Compare a measure<select value={measureIndex} onChange={event => setMeasureIndex(Number(event.target.value))}>
        {rows.map(({ label }, index) => <option value={index} key={label}>{label}</option>)}
      </select></label>
      <dl aria-live="polite">{companies.map(company => <div key={company.ID}>
        <dt>{company["Standardised Company Name"]}</dt><dd>{rows[measureIndex].value(company)}</dd>
        <Link href={`/companies/${company.ID}#company-fundamental`}>Fundamental chapter</Link>
        <Link href={`/companies/${company.ID}#company-technical`}>Technical chapter</Link>
        <button type="button" aria-label={`Remove ${company["Standardised Company Name"]} from comparison`} onClick={() => onRemove(company.ID)}>Remove</button>
      </div>)}</dl>
    </div>}
    <SelectedCompanyCharts companies={companies} />
    {!compact && <div className="side-by-side-scroll"><table><thead><tr><th>MEASURE</th>{companies.map((company) => <th key={company.ID}><span>{company["Standardised Company Name"]}</span><Link href={`/companies/${company.ID}#company-fundamental`}>Fundamental chapter</Link><Link href={`/companies/${company.ID}#company-technical`}>Technical chapter</Link><button aria-label={`Remove ${company["Standardised Company Name"]} from comparison`} onClick={() => onRemove(company.ID)}>Remove</button></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th>{companies.map((company) => <td key={company.ID}>{row.value(company)}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}

function metricValue(company: Company, key: SortKey): number | null {
  if (key === "name") return null;
  if (key === "fundamental") return score(company.fundamental_research, "Final Score");
  if (key === "technical") return score(company.technical_research, "Total Score (100)");
  if (key === "risk") return number(cell(company.integrated_scorecard, "Total Risk Flags"));
  return score(company.integrated_scorecard, integratedKey);
}

const visualMetricOptions: { key: VisualMetric; label: string }[] = [
  { key: "fundamental", label: "Fundamental score / 100" }, { key: "technical", label: "Technical score / 100" },
  { key: "integrated", label: "Integrated score / 100" }, { key: "profitability", label: "Profitability score / 100" },
  { key: "growth", label: "Growth score / 100" }, { key: "financial-strength", label: "Financial strength / 100" },
  { key: "valuation", label: "Valuation score / 100" },
  { key: "revenue", label: "Revenue · Rs Cr" }, { key: "net-profit", label: "Net profit · Rs Cr" },
  { key: "roce", label: "ROCE · %" }, { key: "debt-equity", label: "Debt / equity · x" },
  { key: "current-ratio", label: "Current ratio · x" },
];
const fundamentalFieldByMetric: Record<"profitability" | "growth" | "financial-strength" | "valuation", string> = {
  profitability: fundamentalComponentMetrics[0].field, growth: fundamentalComponentMetrics[1].field,
  "financial-strength": fundamentalComponentMetrics[2].field, valuation: fundamentalComponentMetrics[3].field,
};
function visualMetricValue(company: Company, key: VisualMetric) {
  if (key === "fundamental" || key === "technical" || key === "integrated") return metricValue(company, key);
  if (key === "profitability" || key === "growth" || key === "financial-strength" || key === "valuation") return number(cell(company.fundamental_scorecard, fundamentalFieldByMetric[key]));
  const metricField: Record<"revenue" | "net-profit" | "roce" | "debt-equity" | "current-ratio", string> = {
    revenue: fundamentalTrendMetrics[0].field, "net-profit": fundamentalTrendMetrics[2].field,
    roce: fundamentalTrendMetrics[3].field, "debt-equity": fundamentalTrendMetrics[5].field,
    "current-ratio": fundamentalTrendMetrics[6].field,
  };
  const metric = fundamentalTrendMetrics.find((item) => item.field === metricField[key])!;
  return number(cell(company.fundamental_trends.at(-1), metric.field)) === null ? null : number(cell(company.fundamental_trends.at(-1), metric.field))! * metric.multiplier;
}
const visualMetricLabel = (key: VisualMetric) => visualMetricOptions.find((item) => item.key === key)?.label ?? key;
const visualMetricUnit = (key: VisualMetric) => key === "revenue" || key === "net-profit" ? "Rs Cr" : key === "roce" ? "%" : key === "debt-equity" || key === "current-ratio" ? "x" : "score / 100";

function ComparisonWorkspace({ companies, recommendations, compareIds, onToggle, onOpen, query, setQuery, categoryFilter, setCategoryFilter, mode, setMode, axisX, setAxisX, axisY, setAxisY, sort, ascending, onSort }: { companies: Company[]; recommendations: Recommendation[]; compareIds: string[]; onToggle: (id: string) => void; onOpen: (id: string) => void; query: string; setQuery: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void; mode: "Table" | "Scatter" | "Rank bars" | "Heatmap"; setMode: (value: "Table" | "Scatter" | "Rank bars" | "Heatmap") => void; axisX: VisualMetric; setAxisX: (value: VisualMetric) => void; axisY: VisualMetric; setAxisY: (value: VisualMetric) => void; sort: SortKey; ascending: boolean; onSort: (value: SortKey) => void }) {
  const reduceMotion = useReducedMotion();
  const desktop = useDesktopPresentation();
  const compact = useCompactResearch();
  const selectedCompanies = compareIds.flatMap(id => companies.find(company => company.ID === id) ?? []);
  const categoriesWithWinners = recommendations.map((item) => item.Category.replace(/^\d+\.\s*/, ""));
  const rows = companies.filter((company) => {
    const matchesText = `${company["Standardised Company Name"]} ${company["NSE Symbol (standardised)"]} ${company["Peer Group (analyst assumption, fundamental workbook)"]}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "All categories" || recommendations.some((item) => item.Category.replace(/^\d+\.\s*/, "") === categoryFilter && item["Selected Company (model, eligible only)"] === company["Standardised Company Name"]);
    return matchesText && matchesCategory;
  }).sort((a, b) => {
    if (sort === "name") return ascending ? a["Standardised Company Name"].localeCompare(b["Standardised Company Name"]) : b["Standardised Company Name"].localeCompare(a["Standardised Company Name"]);
    const left = metricValue(a, sort); const right = metricValue(b, sort);
    if (left === null) return 1; if (right === null) return -1;
    return ascending ? left - right : right - left;
  });
  const metricOptions = visualMetricOptions;
  const [scatterId, setScatterId] = useState("");
  const scatterCompany = rows.find(company => company.ID === scatterId);
  const scatterX = scatterCompany ? visualMetricValue(scatterCompany, axisX) : null;
  const scatterY = scatterCompany ? visualMetricValue(scatterCompany, axisY) : null;
  const pickScatterPoint = (id: string) => compact ? setScatterId(id) : onOpen(id);
  const svgWidth = compact ? 340 : 760; const svgHeight = compact ? 290 : 430; const margin = compact ? 49 : 54;
  const xs = rows.map((row) => visualMetricValue(row, axisX)).filter((value): value is number => value !== null);
  const ys = rows.map((row) => visualMetricValue(row, axisY)).filter((value): value is number => value !== null);
  const scaleDomain = (values: number[], key: VisualMetric): [number, number] => {
    if (["fundamental", "technical", "integrated", "profitability", "growth", "financial-strength", "valuation"].includes(key)) return [0, 100];
    const low = Math.min(...values, 0); const high = Math.max(...values, 0);
    const pad = (high - low || Math.abs(high || low) || 1) * .08;
    return [low - pad, high + pad];
  };
  const xDomain = scaleDomain(xs, axisX); const yDomain = scaleDomain(ys, axisY);
  const xScale = scaleLinear().domain(xDomain).nice().range([margin, svgWidth - (compact ? 18 : margin)]);
  const yScale = scaleLinear().domain(yDomain).nice().range([svgHeight - margin, margin]);
  const rankMetric = axisX;
  const maxRank = Math.max(...rows.map((company) => Math.abs(visualMetricValue(company, rankMetric) ?? 0)), 1);
  const rankRows = rows.slice().sort((a, b) => (visualMetricValue(b, rankMetric) ?? -Infinity) - (visualMetricValue(a, rankMetric) ?? -Infinity));
  return <section className="comparison-page">
    <header className="editorial-heading"><span className="section-marker">COMPARATIVE ENGINE · {rows.length} OF {companies.length} COMPANIES</span><h1>Read across the field.</h1><p>Sort source-backed scores, isolate category selections and compare a focused set side by side. Missing values remain unranked.</p></header>
    <div className="comparison-controls"><label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company, ticker or peer group" /></label><label><span>Category selection</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{categoriesWithWinners.map((category) => <option key={category}>{category}</option>)}</select></label><div className="view-switch" aria-label="Comparison view">{(["Table", "Scatter", "Rank bars", "Heatmap"] as const).map((item) => <button key={item} aria-pressed={mode === item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{compact && item === "Table" ? "Company list" : item}{mode === item && <motion.span className="motion-tab-ink" layoutId="comparison-mode-ink" transition={{ type: "spring", stiffness: 360, damping: 34 }} aria-hidden="true" />}</button>)}</div></div>
    {selectedCompanies.length > 0 && <div className="comparison-selected">
      <span>{selectedCompanies.length} selected · up to 3 companies</span>
      {selectedCompanies.map(company => <button key={company.ID} onClick={() => onToggle(company.ID)}>{company["Standardised Company Name"]} ×</button>)}
      {selectedCompanies.length >= 2 && <a className="comparison-chart-jump" href="#selected-comparison">{compact ? "Compare selected" : "View selected charts"}</a>}
    </div>}
    <div key={mode} className="comparison-stage" data-motion-stage={mode}>
    {mode === "Table" && (compact ? <CompactCompanyList companies={rows} recommendations={recommendations} onOpen={onOpen} sort={sort} ascending={ascending} onSort={onSort} comparison={{ ids: compareIds, onToggle }} /> : <><div className="table-scroll compare-table-wrap"><table className="universe-table"><thead><tr><th className="sticky-company">Company</th><th>Peer group</th>{(["fundamental", "technical", "integrated", "risk"] as SortKey[]).map((key) => <th key={key}><button className="sort-button" onClick={() => onSort(key)}>{key === "risk" ? "Risk flags" : `${key[0].toUpperCase()}${key.slice(1)} score`}{sort === key ? ascending ? " ↑" : " ↓" : ""}</button></th>)}<th>Category selection</th><th>Open</th></tr></thead><tbody>{rows.map((company) => {
      const riskCount = number(cell(company.integrated_scorecard, "Total Risk Flags"));
      const winner = recommendations.find((item) => item["Selected Company (model, eligible only)"] === company["Standardised Company Name"]);
      const integratedScore = metricValue(company, "integrated");
      return <tr key={company.ID}><td className="sticky-company"><label className="company-check"><input type="checkbox" checked={compareIds.includes(company.ID)} onChange={() => onToggle(company.ID)} aria-label={`Select ${company["Standardised Company Name"]} for comparison`} /><span>{company["Standardised Company Name"]}<small>{company["NSE Symbol (standardised)"]} · {company.ID}</small></span></label></td><td title={company["Peer Group (analyst assumption, fundamental workbook)"]}>{company["Peer Group (analyst assumption, fundamental workbook)"]}</td><td className="numeric">{formatScore(metricValue(company, "fundamental"))}</td><td className="numeric">{formatScore(metricValue(company, "technical"))}</td><td className="numeric"><div className="integrated-score"><strong>{formatScore(integratedScore)}</strong>{integratedScore !== null && <span><i style={{ width: `${Math.max(0, Math.min(100, integratedScore))}%` }} /></span>}</div></td><td className="numeric">{riskCount === null ? "—" : riskCount}</td><td>{winner?.Category.replace(/^\d+\.\s*/, "") ?? "—"}</td><td><button className="text-action" onClick={() => onOpen(company.ID)}>Research</button></td></tr>;
    })}</tbody></table></div><p className="chart-caption">Fundamental scores use FY 2025-26 source data. Technical scores use each company latest source observation; dates are available in its company research file.</p></>)}
    {mode === "Scatter" && <div className="comparison-chart"><div className="chart-controls"><label>X axis<select value={axisX} onChange={(event) => setAxisX(event.target.value as VisualMetric)}>{metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>Y axis<select value={axisY} onChange={(event) => setAxisY(event.target.value as VisualMetric)}>{metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div><PlotTransition revision={desktop ? "scatter" : axisX + ":" + axisY + ":" + rows.map(company => company.ID).join(",")}><svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={`${visualMetricLabel(axisX)} versus ${visualMetricLabel(axisY)} across the filtered company universe`}>{Array.from({ length: 5 }, (_, index) => index).map((tick) => { const xv = xDomain[0] + (xDomain[1] - xDomain[0]) * tick / 4; const yv = yDomain[0] + (yDomain[1] - yDomain[0]) * tick / 4; return <g key={tick}><line x1={margin} x2={svgWidth - margin} y1={yScale(yv)} y2={yScale(yv)} className="scatter-grid" /><text x={margin - 10} y={yScale(yv) + 4} textAnchor="end" className="scatter-tick">{yv.toFixed(0)}</text><text x={xScale(xv)} y={svgHeight - 18} textAnchor="middle" className="scatter-tick">{xv.toFixed(0)}</text></g>; })}{rows.map((company) => { const x = visualMetricValue(company, axisX); const y = visualMetricValue(company, axisY); if (x === null || y === null) return null; return <g key={company.ID} role="button" tabIndex={0} aria-label={company["Standardised Company Name"]} {...pointReadout(company["Standardised Company Name"], [
      { name: visualMetricLabel(axisX), value: x.toFixed(1) },
      { name: visualMetricLabel(axisY), value: y.toFixed(1) },
    ])} className={compact && scatterId === company.ID ? "compare-dot is-active" : "compare-dot"} style={{ color: companyColor(company.ID), transform: desktop ? `translate(${xScale(x)}px, ${yScale(y)}px)` : undefined }} onClick={() => pickScatterPoint(company.ID)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickScatterPoint(company.ID); } }}>{compact && <circle className="scatter-hit-area" cx={xScale(x)} cy={yScale(y)} r={11} />}<circle cx={desktop ? 0 : xScale(x)} cy={desktop ? 0 : yScale(y)} r={compact ? (compareIds.includes(company.ID) ? 5 : 3.5) : (compareIds.includes(company.ID) ? 7 : 5)} /></g>; })}<text x={svgWidth / 2} y={svgHeight - 2} textAnchor="middle" className="scatter-axis-title">{visualMetricLabel(axisX)}</text><text x={13} y={svgHeight / 2} textAnchor="middle" className="scatter-axis-title" transform={`rotate(-90 13 ${svgHeight / 2})`}>{visualMetricLabel(axisY)}</text></svg></PlotTransition><p className="chart-caption">Only companies with numeric source values on both axes are plotted. Each axis uses its own units. {compact ? "Tap a point to read its values." : "Select a point to open research."}</p>
      {compact && scatterCompany && scatterX !== null && scatterY !== null && <div className="mobile-scatter-reading" aria-live="polite">
        <strong>{scatterCompany["Standardised Company Name"]}</strong>
        <span>{visualMetricLabel(axisX)} <b>{scatterX.toFixed(1)}</b></span><span>{visualMetricLabel(axisY)} <b>{scatterY.toFixed(1)}</b></span>
        <button type="button" onClick={() => onOpen(scatterCompany.ID)}>Open research <ChevronRight size={15} aria-hidden="true" /></button>
      </div>}<div className="chart-series-legend" aria-label="Company colours">{rows.filter(company => visualMetricValue(company, axisX) !== null && visualMetricValue(company, axisY) !== null).map(company => <span key={company.ID}><i style={{ backgroundColor: companyColor(company.ID) }} />{company["NSE Symbol (standardised)"]}</span>)}</div></div>}
    {mode === "Rank bars" && <div className="rank-bars"><div className="chart-controls"><label>Score metric<select value={axisX} onChange={(event) => setAxisX(event.target.value as VisualMetric)}>{metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>{rankRows.filter((company) => visualMetricValue(company, rankMetric) !== null).map((company, index) => { const value = visualMetricValue(company, rankMetric)!; return <motion.button layout={!reduceMotion} transition={{ type: "spring", stiffness: 180, damping: 25 }} key={company.ID} className={value < 0 ? "rank-bar-row negative" : "rank-bar-row"} onClick={() => onOpen(company.ID)}><span>{String(index + 1).padStart(2, "0")}</span><b>{company["Standardised Company Name"]}</b><i><motion.span style={desktop ? { transformOrigin: "left" } : undefined} animate={desktop ? { scaleX: Math.abs(value) / maxRank } : { width: `${Math.abs(value) / maxRank * 100}%` }} transition={{ duration: reduceMotion ? 0 : .54, ease: [0.22,1,0.36,1] }} /></i><strong>{value.toFixed(1)} {visualMetricUnit(rankMetric)}</strong></motion.button>; })}{!rankRows.some((company) => visualMetricValue(company, rankMetric) !== null) && <p className="chart-state">No values are available for this selection.</p>}</div>}
    {mode === "Heatmap" && <ScoreHeatmap companies={rows} onOpen={onOpen} />}
    </div>
    <SideBySideComparison companies={selectedCompanies} recommendations={recommendations} onRemove={onToggle} />
  </section>;
}

function RankingsPage({ companies, recommendations, category, onCategory, onOpen }: { companies: Company[]; recommendations: Recommendation[]; category: string; onCategory: (value: string) => void; onOpen: (id: string) => void }) {
  const recommendation = recommendations.find((item) => item.Category.replace(/^\d+\.\s*/, "") === category);
  const winner = companies.find((company) => company["Standardised Company Name"] === recommendation?.["Selected Company (model, eligible only)"]);
  const rankingSets = [{ title: "Fundamental ranking", row: (company: Company) => company.fundamental_research, field: "Overall Rank", scoreField: "Final Score" }, { title: "Technical ranking", row: (company: Company) => company.technical_research, field: "Rank", scoreField: "Total Score (100)" }, { title: "Integrated scorecard", row: (company: Company) => company.integrated_scorecard, field: "Integrated Rank", scoreField: integratedKey }];
  return <section className="rankings-page"><header className="editorial-heading"><span className="section-marker">RANKINGS & CATEGORIES</span><h1>Three scores. Seven lenses.</h1><p>Fundamental, technical and integrated rankings are separate workbook outputs. Category selections are an additional model layer.</p></header><div className="category-feature"><div className="category-tabs" role="tablist" aria-label="Investor categories">{categories.map((label) => <button role="tab" aria-selected={category === label} key={label} className={category === label ? "category-tab active" : "category-tab"} onClick={() => onCategory(label)}>{label}{category === label && <motion.span className="motion-tab-ink" layoutId="ranking-category-ink" transition={{ type: "spring", stiffness: 360, damping: 34 }} aria-hidden="true" />}</button>)}</div><ViewTransition key={category} name="ferrum-ranking-selection" share="ferrum-selection" enter="ferrum-selection" exit="ferrum-selection" default="none"><div className="recommendation-result"><div><span>{category} · workbook model selection</span><h2>{winner?.["Standardised Company Name"] ?? "No eligible company reported"}</h2></div><div><strong>{formatScore(number(recommendation?.["Model Score (0-100)"] ?? null))}</strong><small>Source model score / 100</small></div><p>{asText(recommendation?.["Relevant Fundamental Evidence"] ?? null)}</p><details className="recommendation-detail"><summary>Technical evidence, sector case, risks and trade-offs</summary><p><b>Technical evidence:</b> {asText(recommendation?.["Relevant Technical Evidence"] ?? null)}</p><p><b>Sector basis:</b> {asText(recommendation?.["Sector-Specific Justification"] ?? null)}</p><p><b>Risks:</b> {asText(recommendation?.["Key Risks & Counterarguments"] ?? null)}</p><p><b>Alternatives and trade-offs:</b> {asText(recommendation?.["Why Competing Candidates Were Not Preferred / Trade-offs"] ?? null)}</p></details>{winner && <button className="compare-action" onClick={() => onOpen(winner.ID)}>Open company research</button>}</div></ViewTransition><p className="ranking-distinction"><b>MODEL RANK IS NOT THE FINAL SELECTION.</b> Shyam Metalics &amp; Energy Ltd. holds integrated rank 1. National Aluminium Co. Ltd. is the source workbook’s Overall Best Investment recommendation.</p></div><div className="ranking-columns">{rankingSets.map((set) => <div key={set.title}><h2>{set.title}</h2>{[...companies].sort((a, b) => (number(set.row(b)?.[set.scoreField]) ?? -Infinity) - (number(set.row(a)?.[set.scoreField]) ?? -Infinity)).map((company, index) => <button className="rank-row" key={company.ID} onClick={() => onOpen(company.ID)}><span>{String(number(set.row(company)?.[set.field]) ?? index + 1).padStart(2, "0")}</span><b>{company["Standardised Company Name"]}</b><Score value={number(set.row(company)?.[set.scoreField] ?? null)} /></button>)}</div>)}</div></section>;
}

function MethodologyPage({ sources, references }: { sources: SourceSheet[]; references: CompanyResearch["sections"] }) {
  const groups = ["IA - Fundamental Analysis.xlsx", "IA - Technical Analysis.xlsx", "IA - Integrated Analysis.xlsx"];
  return <section className="methodology-page"><header className="editorial-heading"><span className="section-marker">METHODOLOGY & SOURCES</span><h1>Trace every conclusion.</h1><p>Ferrum reads the workbooks’ saved cell values. It does not recalculate Excel formulas or substitute live market data.</p></header><div className="method-notes"><article><h2>Fundamental scores</h2><p>The workbook defines category scores as peer-relative metric percentiles on a 0–100 scale. Its weighted final score is shown as saved. Underlying weights are exposed only where the source specifies them.</p></article><article><h2>Technical scores</h2><p>Technical scores use the scorecard and ranking sheets. Prices are source closes (not confirmed adjusted closes); RSI, volume and indicators are the workbook values. The supplied technical series runs from 13 Oct 2023 through 13 Oct 2026.</p></article><article><h2>Integrated assessment</h2><p>The integrated scorecard specifies a 60:40 fundamental-to-dispersion-matched technical blend. Shyam Metalics’ scorecard rank and National Aluminium’s final recommendation are distinct outputs.</p></article></div><div className="source-inventory">{groups.map((source) => <section key={source}><h2>{sourceLabel(source)}</h2>{sources.filter((sheet) => sheet.source === source).map((sheet) => <details key={`${sheet.source}:${sheet.sheet}`}><summary>{sheetLabel(sheet.sheet)}<small>{sheet.records.toLocaleString()} records · {sheet.fields.length} fields · {sheet.company_count} company labels{sheet.date_start ? ` · ${sheet.date_start} to ${sheet.date_end}` : ""} · {sheet.missing_cells.toLocaleString()} blank cells</small></summary><div className="field-list"><p className="source-method">{sheet.source} · {sheet.sheet}</p>{workbookFieldKeys(sheet.fields).map((fieldKey, index) => <span key={fieldKey}>{sheet.fields[index]}</span>)}</div></details>)}</section>)}{!sources.length && <p className="chart-state">Loading source inventory, or source inventory is unavailable.</p>}</div><div className="method-reference"><h2>Source definitions and selection rules</h2>{references.map((section) => <SourceSheetDisclosure key={`${section.source}-${section.sheet}`} section={section} clean />)}</div><aside className="method-limitations"><h2>Known limits</h2><ul><li>Company scores, rankings and category selections are research outputs. Investment advice and recommendations to buy, sell or hold securities are outside the scope of this project.</li><li>Workbook formulas are not recalculated; blank saved formula results stay unavailable.</li><li>Technical closes are not confirmed as corporate-action adjusted.</li><li>The sector document contains authored historical claims and no verified machine-readable macro time series.</li><li>Peer group and subsector labels are identified in the workbook as analyst assumptions.</li></ul></aside></section>;
}

type SectorSection = { heading: string | null; paragraphs: string[] };

function sourceSentences(text: string) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z“"₹])/).map((sentence) => sentence.trim()).filter(Boolean);
}

function sourceFigures(text: string) {
  const pattern = /(?:₹|\$)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:lakh crore|million tonnes?|tonnes?|tonne|crore|lakh|per tonne))?|\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent|per cent|million tonnes?|million|billion|lakh crore|tonnes?|tonne|kg|megawatt hours? per tonne)/gi;
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0].trim()))];
}

function sourceComparison(paragraphs: string[]) {
  const pattern = /\bfrom\s+((?:₹|\$)?\s*\d[\d,]*(?:\.\d+)?)\s*(million tonnes?|tonnes?|tonne|kg|million|lakh crore|crore|lakh|%)\s+in\s+((?:FY\s*)?\d{4}(?:[-–]\d{2,4})?)\s+to\s+(?:about\s+)?((?:₹|\$)?\s*\d[\d,]*(?:\.\d+)?)\s*\2\s+(?:in|by)\s+((?:FY\s*)?\d{4}(?:[-–]\d{2,4})?)/i;
  for (const paragraph of paragraphs) {
    const match = pattern.exec(paragraph);
    if (!match) continue;
    const values = [match[1], match[4]].map((value) => Number(value.replace(/[^\d.]/g, "")));
    const maximum = Math.max(...values);
    return {
      sentence: sourceSentences(paragraph).find((sentence) => pattern.test(sentence)) ?? paragraph,
      unit: match[2],
      observations: [
        { period: match[3], value: match[1], width: values[0] / maximum * 100 },
        { period: match[5], value: match[4], width: values[1] / maximum * 100 },
      ],
    };
  }
  return null;
}

function sourceFigureExcerpts(group: SectorSection) {
  return group.paragraphs.filter((paragraph) => !/^source:/i.test(paragraph)).flatMap((paragraph) =>
    sourceSentences(paragraph).map((sentence) => ({ sentence, figures: sourceFigures(sentence) })).filter((item) => item.figures.length),
  ).sort((a, b) => b.figures.length - a.figures.length).slice(0, 2);
}

const SectorEvidenceStage = memo(function SectorEvidenceStage({ group, source, chapterIndex, className = "" }: {
  group: SectorSection;
  source: string;
  chapterIndex: number;
  className?: string;
}) {
  const comparison = sourceComparison(group.paragraphs);
  const excerpts = sourceFigureExcerpts(group);
  const sourcePassages = group.paragraphs.filter((paragraph) => !/^source:/i.test(paragraph));
  const qualitativePassage = sourcePassages.flatMap(sourceSentences).find((sentence) => sentence.length >= 100)
    ?? sourcePassages.find((paragraph) => paragraph.length >= 70)
    ?? sourcePassages[0] ?? null;
  const citedSources = group.paragraphs.filter((paragraph) => /^source:/i.test(paragraph));
  const chapterNumber = group.heading?.match(/^\d+(?:\.\d+)*/)?.[0] ?? String(chapterIndex + 1).padStart(2, "0");

  return <section className={`sector-visual-stage ${className}`} aria-label={`Source visual for ${group.heading ?? "sector context"}`}>
    <div className="sector-visual-heading"><span className="section-marker">SOURCE EXHIBIT</span><span>{chapterNumber}</span></div>
    {comparison ? <div className="sector-comparison" role="img" aria-label={`Source comparison: ${comparison.observations.map((item) => `${item.value} ${comparison.unit} in ${item.period}`).join("; ")}`}>
      {comparison.observations.map((item) => <div className="sector-comparison-row" key={item.period}><span>{item.period}</span><div className="sector-comparison-track"><i style={{ width: `${item.width}%` }} /></div><strong>{item.value}<small> {comparison.unit}</small></strong></div>)}
      <p>{comparison.sentence}</p>
    </div> : excerpts.length ? <div className="sector-figure-excerpts">{excerpts.map((item, index) => <article className="sector-figure-excerpt" key={`${index}-${item.sentence}`}>
      <div className="sector-figure-values">{item.figures.slice(0, 4).map((figure, figureIndex) => <strong key={`${figure}-${figureIndex}`}>{figure}</strong>)}</div><p>{item.sentence}</p>
    </article>)}</div> : qualitativePassage ? <blockquote className="sector-visual-quote">{qualitativePassage}</blockquote> : <div className="sector-visual-chapter"><strong>{chapterNumber}</strong><p>{group.heading}</p></div>}
    <footer className="sector-visual-source">{citedSources[0] ?? source}</footer>
  </section>;
});

function SectorStory({ sector, companies, selectedId, onSelect }: { sector: SectorResearch | null; companies: Company[]; selectedId: string; onSelect: (id: string) => void }) {
  const desktop = useDesktopPresentation();
  const compact = useCompactResearch();
  const [activeChapter, setActiveChapter] = useState(0);
  const reduceMotion = useReducedMotion();
  const groups = useMemo(() => {
    const result: SectorSection[] = [];
    for (const paragraph of sector?.paragraphs ?? []) {
      if (/^\d+(?:\.\d+)*\.?\s/.test(paragraph)) result.push({ heading: paragraph, paragraphs: [] });
      else if (result.length) result[result.length - 1].paragraphs.push(paragraph);
      else result.push({ heading: null, paragraphs: [paragraph] });
    }
    return result;
  }, [sector]);
  useEffect(() => {
    const sections = groups.map((_, index) => document.getElementById(`sector-${index}`)).filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (!sections.length) return;
    const updateActiveChapter = () => {
      const anchor = window.innerHeight * .42;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      sections.forEach((section, index) => {
        const bounds = section.getBoundingClientRect();
        const distance = anchor < bounds.top ? bounds.top - anchor : anchor > bounds.bottom ? anchor - bounds.bottom : 0;
        if (distance < nearestDistance) { nearestIndex = index; nearestDistance = distance; }
      });
      setActiveChapter((current) => current === nearestIndex ? current : nearestIndex);
    };
    const observer = new IntersectionObserver(updateActiveChapter, { rootMargin: "-38% 0px -52% 0px" });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [groups]);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".sector-aside .sector-chapter-nav");
    const active = nav?.querySelector<HTMLButtonElement>("button.active");
    if (!nav || !active) return;
    const target = nav.scrollTop + active.getBoundingClientRect().top - nav.getBoundingClientRect().top - (nav.clientHeight - active.clientHeight) / 2;
    nav.scrollTo({ top: target, behavior: reduceMotion ? "instant" : "smooth" });
  }, [activeChapter, reduceMotion]);

  const activeGroup = groups[activeChapter] ?? groups[0];
  const source = sector?.source ?? "Industry and sector analysis.docx";
  const showCompanyUniverse = (group: SectorSection | undefined) => Boolean(group?.heading?.startsWith("3.2"));
  const jumpToChapter = (index: number) => {
    setActiveChapter(index);
    document.getElementById(`sector-${index}`)?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
  };
  const chapterNavigation = (mobile = false) => <nav className={`sector-chapter-nav${mobile ? " sector-chapter-nav-mobile" : ""}`} aria-label="Sector chapters">{groups.map((group, index) => group.heading ? <button key={`${index}-${group.heading}`} className={activeChapter === index ? "active" : ""} onClick={() => jumpToChapter(index)}>{group.heading}</button> : null)}</nav>;

  const exhibit = <SectorEvidenceStage group={activeGroup ?? { heading: null, paragraphs: [] }} source={source} chapterIndex={activeChapter} />;
  return <div className="sector-layout"><div className="sector-story"><div className="section-heading"><div><span className="section-marker">SECTOR RESEARCH · SOURCE JOURNAL</span><h2>Materials behind the economy.</h2></div><Provenance kind="SRC">{source}</Provenance></div>
    <div className="sector-warning"><b>STALE / UNVERIFIED CONTEXT</b><p>The supplied document contains dated economic and market claims. They are shown as source text; Ferrum has not verified them as current facts. No numeric macroeconomic time series was supplied.</p></div>
    {!compact && <div className="paper-panel"><p className="paper-lead">The metals and mining sector sits at the beginning of the industrial supply chain, linking extraction and refining to infrastructure, manufacturing and capital investment.</p><Provenance kind="SRC">Industry and sector analysis.docx · source passage</Provenance></div>}
    {compact ? groups.length > 0 && <label className="sector-chapter-picker">Jump to a sector chapter
      <select value={activeChapter} onChange={event => jumpToChapter(Number(event.target.value))}>
        {groups.map((group, index) => <option key={index} value={index}>{group.heading ?? "Introduction"}</option>)}
      </select>
    </label> : chapterNavigation(true)}
    <div className="story-sections">{groups.map((group, index) => <motion.section className={group.heading ? undefined : "story-intro"} initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .3 }} id={`sector-${index}`} key={`${index}-${group.heading ?? "introduction"}`}>{group.heading && <h3>{group.heading}</h3>}{group.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}<SectorEvidenceStage className="sector-visual-inline" group={group} source={source} chapterIndex={index} />{showCompanyUniverse(group) && <div className="sector-universe-inline"><h4>Company research universe</h4><CompanyScatter companies={companies} selectedId={selectedId} onSelect={onSelect} /></div>}</motion.section>)}</div>
  </div><aside className="sector-aside"><div className="sticky-chart">{chapterNavigation()}<div className="sector-progress" role="progressbar" aria-label="Sector chapter progress" aria-valuenow={activeChapter + 1} aria-valuemin={1} aria-valuemax={Math.max(1, groups.length)}><i style={{ transform: `scaleX(${groups.length ? (activeChapter + 1) / groups.length : 0})` }} /></div><div className="sector-visual-viewport">{desktop ? <div key={activeChapter} className="sector-exhibit-arrival">{exhibit}</div> : <AnimatePresence mode="wait" initial={false}><motion.div key={activeChapter} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5 }} transition={{ duration: reduceMotion ? .12 : .24, ease: "easeOut" }}>{exhibit}</motion.div></AnimatePresence>}</div>{showCompanyUniverse(activeGroup) && <div className="sector-universe-stage"><h3>Company research universe</h3><CompanyScatter companies={companies} selectedId={selectedId} onSelect={onSelect} /></div>}{sector?.factors?.length ? <details className="sector-factor-index"><summary>Workbook sector factors <small>{sector.factors.length} source records</small></summary>{sector.factors.map((item, index) => <article key={String(item.ID ?? `${item["Driver / Factor"] ?? "factor"}-${index}`)}><h4>{String(item["Driver / Factor"] ?? "Sector factor")}</h4><p>{String(item["What the Supplied Document States (information)"] ?? "")}</p><small>{String(item["Document Reference"] ?? "Source reference not reported")}</small></article>)}</details> : null}</div></aside></div>;
}

export default function Home({ routePath = "/" }: { routePath?: string }) {
  const desktop = useDesktopPresentation();
  const [universeRequested, setUniverseRequested] = useState(false);
  const [entranceOpen, setEntranceOpen] = useState(false);
  const hadEntrance = useRef(false);
  const initialPath = useRef(routePath);
  const glassSceneRef = useRef<HTMLElement>(null);
  const applicationRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const view: View = routePath === "/sector" ? "Sector" : routePath === "/compare" ? "Compare" : routePath === "/rankings" ? "Rankings" : routePath === "/methodology" ? "Methodology" : routePath === "/intelligence" ? "Intelligence" : routePath.startsWith("/companies/") ? "Company" : "Overview";
  const reduceMotion = useReducedMotion();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sector, setSector] = useState<SectorResearch | null>(null);
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [sourceSheets, setSourceSheets] = useState<SourceSheet[]>([]);
  const [sourceReferences, setSourceReferences] = useState<CompanyResearch["sections"]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [category, setCategory] = useState(categories[6]);
  const [query, setQuery] = useState("");
  const [sort, setSortState] = useState<SortKey>("integrated");
  const [ascending, setAscending] = useState(false);
  const [priceData, setPriceData] = useState<{ companyId: string; points: PricePoint[]; error: string }>({ companyId: "", points: [], error: "" });
  const [compareIds, toggleCompare] = useComparison();
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false); const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    if (!mobileMenu) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenu(false);
        applicationRef.current?.querySelector<HTMLButtonElement>(".mobile-menu-button")?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
    };
  }, [mobileMenu]);
  const [compareMode, setCompareMode] = useState<"Table" | "Scatter" | "Rank bars" | "Heatmap">("Table");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [axisX, setAxisX] = useState<VisualMetric>("fundamental");
  const [axisY, setAxisY] = useState<VisualMetric>("technical");

  useEffect(() => {
    const html = document.documentElement;
    const syncEntrance = () => setEntranceOpen(html.dataset.entranceState === "active" || html.dataset.entranceState === "revealing");
    syncEntrance();
    const observer = new MutationObserver(syncEntrance);
    observer.observe(html, { attributes: true, attributeFilter: ["data-entrance-state"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hadEntrance.current && !entranceOpen) applicationRef.current?.querySelector<HTMLElement>(".wordmark")?.focus({ preventScroll: true });
    hadEntrance.current = entranceOpen;
  }, [entranceOpen]);

  useEffect(() => {
    if (!loading) window.dispatchEvent(new CustomEvent("ferrum:route-ready", { detail: { path: routePath } }));
  }, [routePath, loading]);

  const replayArtifact = () => {
    window.history.replaceState(window.history.state, "", "/");
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("ferrum:replay-entrance"));
  };

  useEffect(() => {
    if (view !== "Overview" || loading || error) return;
    if (!universeRequested && window.location.hash !== "#company-universe") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("company-universe")?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, loading, error, universeRequested]);

  useEffect(() => {
    let active = true;
    Promise.all([getCompanies(), getRecommendations(), getSectorResearch()]).then(([universe, selections, research]) => {
      if (!active) return;
      setCompanies(universe.companies); setRecommendations(selections.recommendations); setSector(research); setSelectedId(universe.companies.find((company) => company.ID === initialPath.current.split("/")[2])?.ID ?? universe.companies[0]?.ID ?? ""); setLoading(false);
    }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : "Unable to load source data"); setLoading(false); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = companies.find((company) => company.ID === selectedId) ?? null;
  useEffect(() => {
    if (view !== "Company" || !selected) return;
    let active = true;
    getCompanyResearch(selected.ID).then((result) => { if (active) setResearch(result); }).catch(() => { if (active) setResearch(null); });
    return () => { active = false; };
  }, [selected, view]);
  useEffect(() => {
    if (view !== "Methodology") return;
    let active = true;
    getSourceInventory().then((result) => { if (active) { setSourceSheets(result.sources); setSourceReferences(result.references); } }).catch(() => { if (active) { setSourceSheets([]); setSourceReferences([]); } });
    return () => { active = false; };
  }, [view]);
  const pricesLoading = Boolean(selected && priceData.companyId !== selected.ID);
  const prices = !pricesLoading && selected?.ID === priceData.companyId ? priceData.points : [];
  const priceError = !pricesLoading && selected?.ID === priceData.companyId ? priceData.error : "";
  useEffect(() => {
    if (!selected || view !== "Company") return;
    let active = true;
    getCompanyPrices(selected.ID).then((data) => { if (active) setPriceData({ companyId: selected.ID, points: data.points, error: "" }); })
      .catch((reason: unknown) => { if (active) setPriceData({ companyId: selected.ID, points: [], error: reason instanceof Error ? reason.message : "Price history unavailable" }); });
    return () => { active = false; };
  }, [selected, view]);

  const filtered = useMemo(() => {
    const rows = companies.filter((company) => {
      const matchesQuery = `${company["Standardised Company Name"]} ${company["NSE Symbol (standardised)"]} ${company["Subsector (analyst assumption, fundamental workbook)"]}`.toLowerCase().includes(query.toLowerCase());
      const membership = recommendations.some((item) => item.Category.replace(/^\d+\.\s*/, "") === categoryFilter && item["Selected Company (model, eligible only)"] === company["Standardised Company Name"]);
      return matchesQuery && (categoryFilter === "All categories" || membership);
    });
    const value = (company: Company): string | number | null => sort === "name" ? company["Standardised Company Name"] : sort === "risk" ? number(cell(company.integrated_scorecard, "Total Risk Flags")) : sort === "fundamental" ? score(company.fundamental_research, "Final Score") : sort === "technical" ? score(company.technical_research, "Total Score (100)") : score(company.integrated_scorecard, integratedKey);
    return rows.sort((a, b) => { const left = value(a); const right = value(b); if (left === null) return right === null ? 0 : 1; if (right === null) return -1; const order = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right); return ascending ? order : -order; });
  }, [companies, query, sort, ascending, categoryFilter, recommendations]);
  const chosenRecommendation = recommendations.find((item) => item.Category.replace(/^\d+\.\s*/, "") === category) ?? null;
  const recommendationWinner = asText(chosenRecommendation?.["Selected Company (model, eligible only)"]);
  const changeSort = (key: SortKey) => { if (sort === key) setAscending((value) => !value); else { setSortState(key); setAscending(key === "name"); } };
  const changeCategory = (label: string) => {
    const update = () => {
    setCategory(label);
    const choice = recommendations.find((item) => item.Category.replace(/^\d+\.\s*/, "") === label);
    const winner = companies.find((company) => company["Standardised Company Name"] === choice?.["Selected Company (model, eligible only)"]);
    if (winner) setSelectedId(winner.ID);
    };
    if (desktop && !reduceMotion) startTransition(() => { addTransitionType("ferrum-selection"); update(); });
    else update();
    window.dispatchEvent(new Event("ferrum:content-change"));
  };
  const navigate = useCallback((next: View, scrollToTop = true, companyId?: string) => {
    const paths: Record<Exclude<View, "Company">, string> = { Overview: "/", Sector: "/sector", Compare: "/compare", Rankings: "/rankings", Methodology: "/methodology", Intelligence: "/intelligence" };
    const destination = next === "Company" ? `/companies/${encodeURIComponent(companyId ?? selectedId)}` : paths[next];
    setMobileMenu(false); setPaletteOpen(false);
    if (destination && destination !== routePath) {
      if (desktop) announceNavigation(destination);
      router.push(destination, { scroll: scrollToTop, transitionTypes: ["ferrum-route"] });
    }
  }, [desktop, routePath, router, selectedId]);
  const openCompany = (id: string) => {
    navigate("Company", true, id);
  };
  const openUniverse = () => {
    setPaletteOpen(false);
    setMobileMenu(false);
    if (view === "Overview") {
      window.history.replaceState(window.history.state, "", "/#company-universe");
      setUniverseRequested(true);
      document.getElementById("company-universe")?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
    } else { announceNavigation("/#company-universe"); router.push("/#company-universe", { scroll: false, transitionTypes: ["ferrum-route"] }); }
  };

  return <main ref={applicationRef} inert={entranceOpen} className={`app-shell view-${view.toLowerCase()}`}><ApplicationGlass scopeRef={applicationRef} sceneRef={glassSceneRef} view={view} />{desktop === false && <MobileScrollProgress />}<EditorialMotion scopeRef={applicationRef} view={view} reducedMotion={Boolean(reduceMotion)} ready={!loading && !error} /><DesktopMotion view={view} ready={!loading && !error} />
    <header className="topbar">{mobileMenu && <div className="module-menu-backdrop" aria-hidden="true" onClick={() => setMobileMenu(false)} />}<div className="topbar-inner optical-navigation"><LiquidGlassSurface preset="navigation" enabled={!loading && !error} /><Link className="wordmark" onClick={() => setMobileMenu(false)} href="/" aria-label="Ferrum research home">FERRUM<span>RESEARCH</span></Link><button className="mobile-menu-button" aria-expanded={mobileMenu} aria-controls="primary-navigation" aria-label="Toggle module navigation" onClick={() => setMobileMenu((open) => !open)}>{mobileMenu ? <X size={22} /> : <Menu size={22} />}</button>
      <nav id="primary-navigation" className={`module-nav ${mobileMenu ? "open" : ""}`} aria-label="Research modules" onClick={() => setMobileMenu(false)}><Link className={view === "Overview" ? "module-link active" : "module-link"} href="/" transitionTypes={["ferrum-route"]} aria-current={view === "Overview" ? "page" : undefined}>Home{view === "Overview" && <motion.span className="motion-tab-ink" layoutId="primary-navigation-ink" transition={{ type: "spring", stiffness: 340, damping: 32 }} aria-hidden="true" />}</Link><Link className={view === "Company" ? "module-link active" : "module-link"} href="/#company-universe" transitionTypes={["ferrum-route"]} scroll={false} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openUniverse(); } }}>Companies{view === "Company" && <motion.span className="motion-tab-ink" layoutId="primary-navigation-ink" transition={{ type: "spring", stiffness: 340, damping: 32 }} aria-hidden="true" />}</Link>{views.filter((item) => item !== "Overview").map((item) => <Link key={item} className={view === item ? "module-link active" : "module-link"} aria-current={view === item ? "page" : undefined} transitionTypes={["ferrum-route"]} href={item === "Sector" ? "/sector" : `/${item.toLowerCase()}`}>{item === "Sector" ? "Sector Research" : item}{view === item && <motion.span className="motion-tab-ink" layoutId="primary-navigation-ink" transition={{ type: "spring", stiffness: 340, damping: 32 }} aria-hidden="true" />}</Link>)}</nav>
      <button className="palette-trigger" onClick={() => { setMobileMenu(false); setPaletteOpen(true); }} aria-label="Open command search" aria-haspopup="dialog" aria-expanded={paletteOpen}><Search size={17} /><span>Search companies and modules</span><kbd><CommandIcon size={12} /> K</kbd></button>
    </div></header>

    <div key={routePath} className={`page-container${view === "Sector" ? " page-container-sector" : ""}`} id="top">
      {error ? <div className="state-panel"><b>RESEARCH TEMPORARILY UNAVAILABLE</b><p>The research data could not be loaded. Please try again in a moment.</p><button className="compare-action" onClick={() => window.location.reload()}>Try again</button></div> : loading ? <div className="state-panel"><b>{desktop ? "LOADING RESEARCH" : "LOADING SOURCE WORKBOOKS"}</b><p>{desktop ? "Preparing company coverage and research assessments." : "Reading company scorecards and research categories…"}</p></div> : <>
        {view === "Intelligence" ? <IntelligenceHub companies={companies} onOpen={openCompany} /> : view === "Overview" ? <>
          <section className="hero" ref={glassSceneRef}><HeroAtmosphere /><HeroMotion reducedMotion={reduceMotion} /><HeroNetwork companies={companies} /><div className="hero-copy"><span className="section-marker"><span className="section-number">§ 00 — </span>INDIA · METALS &amp; MINING</span><h1><span className="headline-line">Research with</span><span className="headline-line"><em>conviction.</em></span></h1><p>Independent research across India’s metals and mining companies. Explore the fundamentals, read the market signals, and compare the evidence.</p><div className="hero-meta"><Provenance kind="SRC">Integrated, fundamental &amp; technical workbooks</Provenance><span>Universe: {companies.length} companies</span></div><button className="hero-explore liquid-control optical-glass-host" onClick={() => document.getElementById("company-universe")?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth" })}><LiquidGlassSurface preset="cinematic" sceneRef={glassSceneRef} />Explore the universe <ChevronRight size={17} /></button><button className="artifact-replay" data-replay-entrance onClick={replayArtifact}>Replay the artifact</button></div>
    <div className="hero-data liquid-surface optical-glass-host"><LiquidGlassSurface preset="data" sceneRef={glassSceneRef} /><div className="hero-chart-heading"><span>FUNDAMENTAL × TECHNICAL</span><span>PEER-RELATIVE SCORES · 0—100</span></div><CompanyScatter companies={companies} selectedId={selectedId} onSelect={openCompany} /><p className="hero-chart-caption">Select a point to open its source-backed company research. Missing scores are omitted from the plot.</p></div>
          </section>
          <section className="coverage-strip" aria-label="Source coverage"><div><strong>{companies.length}</strong><span>{desktop ? "companies under coverage" : "companies in the master list"}</span></div><div><strong>{companies.filter((company) => company.fundamental_research).length}</strong><span>{desktop ? "fundamental assessments" : "with fundamental summary"}</span></div><div><strong>{companies.filter((company) => company.technical_research).length}</strong><span>{desktop ? "technical assessments" : "with technical summary"}</span></div><div><strong>{companies.filter((company) => company.integrated_scorecard).length}</strong><span>{desktop ? "integrated scorecards" : "with integrated scorecard"}</span></div></section>
          <section className="recommendation-section"><div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 01 — </span>INVESTOR LENS</span><h2>Category selections</h2></div><Provenance kind="SRC">Workbook model selections</Provenance></div>
            <div className="category-tabs" role="tablist" aria-label="Investor categories">{categories.map((label) => <button role="tab" aria-selected={category === label} key={label} className={category === label ? "category-tab active" : "category-tab"} onClick={() => changeCategory(label)}>{label}{category === label && <motion.span className="motion-tab-ink" layoutId="home-category-ink" transition={{ type: "spring", stiffness: 360, damping: 34 }} aria-hidden="true" />}</button>)}</div>
            <ViewTransition key={category} name="ferrum-home-selection" share="ferrum-selection" enter="ferrum-selection" exit="ferrum-selection" default="none"><div className="recommendation-result liquid-surface"><div><span>{category} · selected company</span><h3>{recommendationWinner}</h3></div><div><strong>{formatScore(number(cell(chosenRecommendation, "Model Score (0-100)")))}</strong><small>Workbook score / 100</small></div><p>{asText(cell(chosenRecommendation, "Relevant Fundamental Evidence"))}</p><Provenance kind="ANALYST">See company analysis for risks, trade-offs and evidence limitations.</Provenance><button className="compare-action" onClick={() => { const winner = companies.find((item) => item["Standardised Company Name"] === recommendationWinner); if (winner) openCompany(winner.ID); }}>Open selected company</button></div></ViewTransition>
            <p className="ranking-distinction"><b>MODEL RANK ≠ FINAL SELECTION</b> Shyam Metalics &amp; Energy Ltd. ranks first in the integrated scorecard. National Aluminium Co. Ltd. is the final Overall Best Investment recommendation.</p>
          </section>
          <section className="universe-section" id="company-universe"><div className="section-heading"><div><span className="section-marker"><span className="section-number">§ 02 — </span>COMPANY UNIVERSE</span><h2>Compare the field.</h2></div><div className="universe-search"><Search size={18} /><input aria-label="Filter companies" placeholder="Filter by company, ticker or subsector" value={query} onChange={(event) => setQuery(event.target.value)} /><span>{filtered.length} / {companies.length}</span></div></div>
            <ComparisonTable companies={filtered} recommendations={recommendations} selectedId={selectedId} onSelect={openCompany} sort={sort} ascending={ascending} onSort={changeSort} />
            <div className="table-source"><Provenance kind="SRC">Company master and scorecards · latest saved workbook outputs</Provenance><span>Blank values indicate missing source data; they are not scored as zero.</span></div>
          </section>
          <SideBySideComparison companies={companies.filter((company) => compareIds.includes(company.ID))} recommendations={recommendations} onRemove={toggleCompare} />
          <section className="universe-links"><p>Open any company for the full workbook-backed research file.</p><button className="compare-action" onClick={() => navigate("Compare")}>Open comparison engine</button><button className="compare-action" onClick={() => navigate("Rankings")}>View rankings and categories</button></section>
          <section className="sector-teaser"><div><span className="section-marker"><span className="section-number">§ 04 — </span>SECTOR JOURNAL</span><h2>Materials behind the economy.</h2><p>Source-led industry and macro context from the supplied sector research document. Dated claims remain attributed to that source.</p>{(sector?.factors ?? []).slice(0, 3).map((factor) => <p className="sector-observation" key={String(factor.ID ?? factor["Driver / Factor"])}><b>{String(factor["Driver / Factor"] ?? "Sector factor")}</b>: {String(factor["What the Supplied Document States (information)"] ?? "")}</p>)}</div><button className="text-action" onClick={() => navigate("Sector")}>Read sector research <ChevronRight size={16} /></button></section>
        </> : view === "Sector" ? <SectorStory sector={sector} companies={companies} selectedId={selectedId} onSelect={openCompany} /> : view === "Compare" ? <ComparisonWorkspace companies={companies} recommendations={recommendations} compareIds={compareIds} onToggle={toggleCompare} onOpen={openCompany} query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} mode={compareMode} setMode={setCompareMode} axisX={axisX} setAxisX={setAxisX} axisY={axisY} setAxisY={setAxisY} sort={sort} ascending={ascending} onSort={changeSort} /> : view === "Rankings" ? <RankingsPage companies={companies} recommendations={recommendations} category={category} onCategory={changeCategory} onOpen={openCompany} /> : view === "Methodology" ? <MethodologyPage sources={sourceSheets} references={sourceReferences} /> : selected ? <section className="dedicated-company"><CompanyPanel key={selected.ID} company={selected} prices={prices} pricesLoading={pricesLoading} priceError={priceError} compareIds={compareIds} onCompare={() => toggleCompare(selected.ID)} onOpen={openCompany} research={research} companies={companies} recommendations={recommendations} /></section> : <div className="state-panel"><b>COMPANY NOT FOUND</b><p>The requested company ID is not in the source company master.</p></div>}
      </>}
      <footer className="page-footer">
        <span>FERRUM <i>INDEPENDENT RESEARCH PROJECT</i></span>
        <span>For informational use only. Investment advice is outside the scope of this project.</span>
        <span>AI INTERPRETATION IS LABELLED AND CITATION-VALIDATED</span>
      </footer>
    </div>
    <Command.Dialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Search Ferrum" className="command-dialog" onClick={event => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><div className="command-box"><LiquidGlassSurface preset="editorial" /><div className="command-search"><Search size={18} /><Command.Input autoFocus placeholder="Search companies or modules…" /><kbd>ESC</kbd><button type="button" className="command-close-mobile" aria-label="Close search" onClick={() => setPaletteOpen(false)}><X size={18} /></button></div><Command.List><Command.Empty>No matching companies or modules.</Command.Empty><Command.Group heading="Modules">{views.map((item) => <Command.Item key={item} value={`Module ${item}`} onSelect={() => navigate(item)}>{item} research<ChevronRight size={16} /></Command.Item>)}<Command.Item value="Companies" onSelect={openUniverse}>Companies<ChevronRight size={16} /></Command.Item></Command.Group><Command.Group heading="Companies">{companies.map((company) => <Command.Item key={company.ID} value={`${company["Standardised Company Name"]} ${company["NSE Symbol (standardised)"]}`} onSelect={() => openCompany(company.ID)}>{company["Standardised Company Name"]}<small>{company["NSE Symbol (standardised)"]}</small></Command.Item>)}</Command.Group></Command.List><div className="command-footer">↑↓ navigate <span>↵ select</span><span>Esc or click outside to close</span></div></div></Command.Dialog>
  </main>;
}
