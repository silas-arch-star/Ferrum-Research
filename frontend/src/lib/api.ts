// The frontend proxies research requests, so the browser uses one origin.
const API_URL = "";

export type Cell = string | number | null;
export type WorkbookRow = Record<string, Cell>;

export interface Company {
  ID: string;
  "Standardised Company Name": string;
  "NSE Symbol (standardised)": string;
  "Peer Group (analyst assumption, fundamental workbook)": string;
  "Subsector (analyst assumption, fundamental workbook)": string;
  "Data Availability & Material Limitations": string | null;
  integrated_scorecard: WorkbookRow | null;
  fundamental_research: WorkbookRow | null;
  fundamental_scorecard: WorkbookRow | null;
  fundamental_trends: WorkbookRow[];
  technical_research: WorkbookRow | null;
  technical_insight: WorkbookRow | null;
}

export interface Recommendation {
  Category: string;
  "Selected Company (model, eligible only)": string;
  "Model Score (0-100)": number | null;
  "Eligible Candidates (of 20)": number | null;
  [key: string]: Cell;
}

export interface PricePoint {
  date: string;
  close: number;
  rsi: number | null;
  volume: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
}

export interface SectorResearch {
  source: string;
  paragraphs: string[];
  factors?: WorkbookRow[];
}

export interface ResearchSection {
  source: string;
  sheet: string;
  fields: string[];
  rows: WorkbookRow[];
}

export interface CompanyResearch {
  company_id: string;
  company_name: string;
  sections: ResearchSection[];
}

export interface SourceSheet {
  source: string;
  sheet: string;
  fields: string[];
  records: number;
  company_count: number;
  date_start: string | null;
  date_end: string | null;
  missing_cells: number;
}

export interface IntelligenceSource { source_id: string; title: string; url: string; domain: string; snippet: string; published_at: string | null; retrieved_at: string; topic: string; source_type: string; verification_status: string }
export interface IntelligenceClaim { text: string; basis: "external_fact" | "internal_fact" | "calculation" | "interpretation"; source_ids: string[]; internal_references: string[] }
export interface IntelligenceBrief { status: "complete" | "partial" | "insufficient_evidence"; executive_conclusion: string; current_thesis: string; supporting_findings: IntelligenceClaim[]; contradictory_evidence: IntelligenceClaim[]; bull_case: IntelligenceClaim[]; bear_case: IntelligenceClaim[]; risks: IntelligenceClaim[]; catalysts: IntelligenceClaim[]; internal_interpretation: IntelligenceClaim[]; external_developments: IntelligenceClaim[]; thesis_implications: IntelligenceClaim[]; conflicts: IntelligenceClaim[]; unknowns: string[]; confidence_label: string; confidence_basis: string }
export type ResearchMode = "automated" | "focused" | "workbook" | "web";
export interface WorkbookRead { reference: string; workbook: string; sheet: string; scope: "company" | "sheet"; records: number; available: number }
export type ResearchSynthesis = "gemini" | "source_digest" | "local_analysis";
export interface ResearchChart {
  id: string;
  title: string;
  kind: "line" | "bar";
  source: string;
  period: string;
  unit: string;
  context: boolean;
  series: { key: string; name: string }[];
  rows: ({ label: string } & Record<string, string | number | null>)[];
}
export interface ResearchSnapshot { charts?: ResearchChart[]; snapshot_id: string; company_id: string; company_name: string; question: string; generated_at: string; model: string; internal_data_as_of: string | null; evidence_status: string; sources: IntelligenceSource[]; brief: IntelligenceBrief; citation_warnings: string[]; mode?: ResearchMode; synthesis?: ResearchSynthesis; synthesis_note?: string | null; workbook_reads?: WorkbookRead[]; searches?: { query: string; status: string; results: number }[] }
export interface ResearchRun { mode: ResearchMode; question: string; refresh: boolean; id: string; company_id: string; stage: "queued" | "reading" | "planning" | "searching" | "writing" | "complete" | "failed"; message: string; snapshot: ResearchSnapshot | null }
export interface IntelligenceStatus { gemini_configured: boolean; gemini_model: string; serpapi_configured: boolean }
export interface ThesisMonitor { state: "first_research" | "comparison_available"; message: string; previous: ResearchSnapshot | null; latest: ResearchSnapshot | null; new_source_ids: string[]; no_longer_in_latest_search: string[]; new_risk_statements: string[]; risk_statements_not_repeated: string[]; new_external_findings: string[]; external_findings_not_repeated: string[] }

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Ferrum API returned ${response.status}`);
  return response.json() as Promise<T>;
}

// Keep the immutable workbook snapshot warm while moving between research routes.
// Live Intelligence endpoints still use request() directly.
const workbookReads = new Map<string, { expires: number; promise: Promise<unknown> }>();
function workbook<T>(path: string): Promise<T> {
  const existing = workbookReads.get(path);
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<T>;
  const promise = request<T>(path).catch(error => {
    if (workbookReads.get(path)?.promise === promise) workbookReads.delete(path);
    throw error;
  });
  workbookReads.set(path, { expires: Date.now() + 60_000, promise });
  return promise;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) { let message = `Ferrum API returned ${response.status}`; try { const detail = await response.json(); message = detail.detail?.message ?? detail.detail?.category ?? message; } catch {} throw new Error(message); }
  return response.json() as Promise<T>;
}

export const getIntelligenceStatus = () => request<IntelligenceStatus>("/api/v1/intelligence/status");
export const getLatestResearch = (id: string, mode: ResearchMode) => request<ResearchSnapshot | null>(`/api/v1/intelligence/companies/${encodeURIComponent(id)}/latest?mode=${mode}`);
export const getThesisMonitor = (id: string, mode: ResearchMode) => request<ThesisMonitor>(`/api/v1/intelligence/companies/${encodeURIComponent(id)}/monitor?mode=${mode}`);
export const createResearchUpdate = (id: string, question: string, refresh = false) => post<ResearchSnapshot>(`/api/v1/intelligence/companies/${encodeURIComponent(id)}/research-updates`, { question, refresh });
const analysisPath = (id: string) => `/api/v1/intelligence/companies/${encodeURIComponent(id)}/analysis-run`;
export const startAnalysisRun = (id: string, question: string, mode: ResearchMode, refresh: boolean) => post<ResearchRun>(analysisPath(id), { question, mode, refresh });
export const getAnalysisRun = (id: string) => request<ResearchRun | null>(analysisPath(id));
export const retrieveEvidence = (id: string, question: string, refresh = false) => post<{ status: string; query: string; retrieved_at: string; results: IntelligenceSource[]; error_category: string | null }>(`/api/v1/intelligence/companies/${encodeURIComponent(id)}/evidence`, { question, refresh });

export async function getCompanies() {
  return workbook<{ count: number; companies: Company[] }>("/api/v1/companies");
}

export async function getRecommendations() {
  return workbook<{ count: number; recommendations: Recommendation[] }>(
    "/api/v1/recommendations",
  );
}

export async function getCompanyPrices(companyId: string) {
  return workbook<{ company_id: string; symbol: string; points: PricePoint[] }>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/prices`,
  );
}

export async function getCompanyResearch(companyId: string) {
  return workbook<CompanyResearch>(`/api/v1/companies/${encodeURIComponent(companyId)}/research`);
}

export async function getSourceInventory() {
  return workbook<{ sources: SourceSheet[]; references: ResearchSection[] }>("/api/v1/sources");
}

export async function getSectorResearch() {
  return workbook<SectorResearch>("/api/v1/sector");
}
