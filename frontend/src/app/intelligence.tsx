"use client";

import { useEffect, useMemo, useState } from "react";
import { useDesktopPresentation } from "@/lib/use-desktop-presentation";
import { getAnalysisRun, startAnalysisRun, getIntelligenceStatus, getLatestResearch, getThesisMonitor, retrieveEvidence } from "@/lib/api";
import type { Company, IntelligenceClaim, IntelligenceSource, IntelligenceStatus, ResearchMode, ResearchRun, ResearchSnapshot, ThesisMonitor, WorkbookRead } from "@/lib/api";

import { sheetLabel, sourceLabel } from "@/lib/source-labels";
import { AutomatedReviewCharts } from "./evidence-charts";

function referenceLabel(reference: string, reads: WorkbookRead[]) {
  const read = reads.find(item => item.reference === reference);
  if (read) return sheetLabel(read.sheet);
  const name = reference.replace(/^internal:/, "");
  const [book, sheet] = name.split(" / ");
  return sheet ? sourceLabel(book) + " / " + sheetLabel(sheet) : name.replaceAll("_", " ");
}

function EvidenceRoom({ sources, status, preview = false }: { sources: IntelligenceSource[]; status: string; preview?: boolean }) {
  const [kind, setKind] = useState("all");
  const visible = sources.filter(source => kind === "all" || source.source_type === kind);
  return <section className="intel-section"><div className="section-heading"><div><span className="section-marker">EVIDENCE ROOM · {sources.length} SOURCES</span><h2>Retrieved records</h2></div>{sources.length > 1 && <label className="intel-filter">Filter <select value={kind} onChange={event => setKind(event.target.value)}><option value="all">All source types</option>{Array.from(new Set(sources.map(item => item.source_type))).map(item => <option key={item}>{item}</option>)}</select></label>}</div>
    {visible.length ? <div className="intel-evidence">{visible.map(source => <article id={preview ? undefined : `evidence-${source.source_id}`} key={source.source_id} className="intel-source"><div className="intel-source-meta"><code>{source.source_id}</code><span>{source.source_type.replaceAll("_", " ")}</span><span>{source.verification_status.replaceAll("_", " ")}</span></div><h3><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></h3><p>{source.snippet || "Search result did not include a snippet."}</p><div className="intel-source-meta"><b>{source.domain}</b><span className="source-timestamp">Published: {source.published_at ?? "Not supplied"}</span><span className="source-timestamp">Retrieved: {new Date(source.retrieved_at).toLocaleString()}</span></div><small>Search result excerpt only; Ferrum has not verified the full article.</small></article>)}</div> : <p className="intel-empty">{status === "not_requested" ? "This brief uses workbook evidence only." : status === "failed" ? "External search failed for this update. No search results are shown; the internal workbook baseline remains separate." : status === "not_configured" ? "External search is not configured. No results were substituted." : "Search completed with no results."}</p>}</section>;
}

function ClaimList({ title, claims, sources, reads = [] }: { title: string; claims: IntelligenceClaim[]; sources: IntelligenceSource[]; reads?: WorkbookRead[] }) {
  if (!claims.length) return null;
  return <section className="intel-section"><span className="section-marker">{title}</span><div className="intel-claims">{claims.map((claim, index) => <article key={`${title}-${index}`}><div className="intel-claim-label">{claim.basis.replaceAll("_", " ")}</div><p>{claim.text}</p>{claim.source_ids.length > 0 && <div className="intel-citations">{claim.source_ids.map(id => { const source = sources.find(item => item.source_id === id); return source ? <a key={id} href={`#evidence-${id}`}>{source.title}</a> : null; })}</div>}{claim.internal_references.map(ref => <small key={ref}>Ferrum source: {referenceLabel(ref, reads)}</small>)}</article>)}</div></section>;
}

function BriefView({ report }: { report: ResearchSnapshot }) {
  const b = report.brief;
  const generated = !report.synthesis || report.synthesis === "gemini";
  const reads = report.workbook_reads ?? [];
  const searches = report.searches ?? [];
  return <div className="intel-report"><header className="intel-report-head"><div><span className="intel-badge">{generated ? "AI RESEARCH BRIEF" : report.synthesis === "local_analysis" ? "LOCAL EVIDENCE ANALYSIS" : "SOURCE EVIDENCE SUMMARY"}</span><p className="section-marker">{report.company_id} · {report.generated_at.replace("T", " ").replace("+00:00", " UTC")}</p><h2>{report.company_name}</h2></div><div className="intel-report-meta"><span>{b.status.replaceAll("_", " ")}</span><span>{modes[report.mode ?? "focused"].label}</span><span>{report.sources.length} web sources</span>{report.mode !== "web" && <span>Technical workbook as of: {report.internal_data_as_of ?? "Not reported"}</span>}</div></header>
    {report.synthesis_note && <p className="intel-status">{report.synthesis_note}</p>}
    <p className="intel-question">Research question: {report.question}</p><section className="intel-conclusion"><span className="section-marker">EXECUTIVE CONCLUSION</span><p>{b.executive_conclusion}</p><small>Qualitative confidence: {b.confidence_label}. {b.confidence_basis}</small></section>
    <section className="intel-section"><span className="section-marker">CURRENT THESIS</span><p className="intel-lead">{b.current_thesis}</p></section>
    {report.mode === "automated" && !!report.charts?.length && <AutomatedReviewCharts charts={report.charts} revision={report.snapshot_id} />}
    <div className="intel-case-grid">
      {b.bull_case.length > 0 && <div><ClaimList title="BULL CASE" claims={b.bull_case} sources={report.sources} reads={report.workbook_reads}/></div>}
      {b.bear_case.length > 0 && <div><ClaimList title="BEAR CASE" claims={b.bear_case} sources={report.sources} reads={report.workbook_reads}/></div>}
    </div>
    <ClaimList title="SUPPORTING FINDINGS" claims={b.supporting_findings} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="CONTRADICTORY EVIDENCE" claims={b.contradictory_evidence} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="FERRUM INTERNAL INTERPRETATION" claims={b.internal_interpretation} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="EXTERNAL DEVELOPMENTS" claims={b.external_developments} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="THESIS IMPLICATIONS" claims={b.thesis_implications} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="MATERIAL RISKS" claims={b.risks} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="POTENTIAL CATALYSTS" claims={b.catalysts} sources={report.sources} reads={report.workbook_reads}/><ClaimList title="CONFLICTS" claims={b.conflicts} sources={report.sources} reads={report.workbook_reads}/>
    {b.unknowns.length > 0 && <section className="intel-section"><span className="section-marker">WHAT REMAINS UNKNOWN</span><ul>{b.unknowns.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
    {report.citation_warnings.length > 0 && <section className="intel-warning"><b>CITATION INTEGRITY</b>{report.citation_warnings.map((item,index)=><p key={index}>{item}</p>)}</section>}
    {(reads.length > 0 || searches.length > 0) && <details className="intel-analysis-trace">
      <summary>Evidence used <small>{reads.length} workbook reads / {searches.length} web searches</small></summary>
      {reads.length > 0 && <div className="intel-trace-list"><h3>Workbook records</h3>{reads.map((read, index) => <div key={read.reference + index}>
        <b>{sheetLabel(read.sheet)}</b><span>{sourceLabel(read.workbook)} / {read.records} of {read.available.toLocaleString()} matching rows</span>
      </div>)}</div>}
      {searches.length > 0 && <div className="intel-trace-list"><h3>Web research</h3>{searches.map(search => <div key={search.query}>
        <b>{search.results} results</b><span>{search.status.replaceAll("_", " ")} / {search.query}</span>
      </div>)}</div>}
    </details>}
    <div id="evidence-room"><EvidenceRoom sources={report.sources} status={report.evidence_status}/></div><p className="intel-disclaimer">{generated ? "Gemini synthesis of the cited evidence." : "Ferrum compiled these observations directly from the available sources."} Review the original sources before drawing a conclusion.</p>
  </div>;
}

const modes = {
  automated: { label: "Automated review", detail: "Read across the workbooks and investigate recent public evidence." },
  focused: { label: "Focused question", detail: "Investigate one question against the company baseline and a targeted search." },
  web: { label: "Web only", detail: "Answer the research question using cited public search excerpts." },
  workbook: { label: "Workbook only", detail: "Analyse the saved source records without a web search." },
} as const;

const stages = ["queued", "reading", "planning", "searching", "writing"] as const;
const stageLabels = { queued: "Prepare", reading: "Read", planning: "Plan", searching: "Search", writing: "Synthesize" };
const defaultQuestion = "Assess earnings quality, balance sheet, valuation, market structure, and material recent developments. Which evidence strengthens or weakens the existing thesis?";
const activeRun = (run: ResearchRun | null) => Boolean(run && run.stage !== "complete" && run.stage !== "failed");

export function CompanyIntelligence({ company }: { company: Company }) {
  const [status, setStatus] = useState<IntelligenceStatus | null>(null);
  const [reports, setReports] = useState<Partial<Record<ResearchMode, ResearchSnapshot>>>({});
  const [monitor, setMonitor] = useState<ThesisMonitor | null>(null);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [mode, setMode] = useState<ResearchMode>("automated");
  const report = reports[mode];
  const [question, setQuestion] = useState(defaultQuestion);
  const [refresh, setRefresh] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidence, setEvidence] = useState<{ status: string; results: IntelligenceSource[] } | null>(null);
  const running = activeRun(run);
  const runMode = running ? run!.mode : mode;
  const visibleStages = stages.filter(stage => {
    if (stage === "reading" || stage === "planning") return runMode === "workbook" || runMode === "automated";
    return stage !== "searching" || runMode !== "workbook";
  });
  const step = visibleStages.findIndex(item => item === run?.stage);

  useEffect(() => {
    let active = true;
    getIntelligenceStatus().then(value => { if (active) setStatus(value); }).catch(() => {});
    getAnalysisRun(company.ID).then(value => {
      if (!active || !value) return;
      setRun(current => current ?? value);
      if (activeRun(value)) {
        setMode(value.mode);
        setQuestion(value.question);
        setRefresh(value.refresh);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [company.ID]);

  useEffect(() => {
    let active = true;
    getLatestResearch(company.ID, mode).then(value => {
      if (active && value) setReports(previous => previous[mode] && previous[mode].generated_at >= value.generated_at
        ? previous : { ...previous, [mode]: value });
    }).catch(() => {});
    return () => { active = false; };
  }, [company.ID, mode]);

  useEffect(() => {
    let active = true;
    getThesisMonitor(company.ID, mode).then(value => { if (active) setMonitor(value); }).catch(() => {});
    return () => { active = false; };
  }, [company.ID, mode, report?.snapshot_id]);

  useEffect(() => {
    if (!running) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      try {
        const state = await getAnalysisRun(company.ID);
        if (!active) return;
        setRun(state);
        failures = 0;
        if (state?.snapshot) setReports(current => ({ ...current, [state.mode]: state.snapshot! }));
        if (!activeRun(state)) {
          if (!state) setError("The analysis session ended. You can start a new run.");
          return;
        }
      } catch {
        if (!active) return;
        if (++failures >= 5) {
          setError("Live status is unavailable. Reload this page to reconnect to the analysis.");
          setRun(null);
          return;
        }
      }
      timer = setTimeout(poll, 1300);
    };
    timer = setTimeout(poll, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [company.ID, running]);

  const generate = async () => {
    setStarting(true);
    setError("");
    setEvidence(null);
    try {
      const state = await startAnalysisRun(company.ID, question.trim() || defaultQuestion, mode, refresh);
      setRun(state);
      if (state.snapshot) setReports(current => ({ ...current, [state.mode]: state.snapshot! }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis could not start.");
    } finally { setStarting(false); }
  };

  const checkEvidence = async () => {
    setEvidenceBusy(true);
    setError("");
    try { setEvidence(await retrieveEvidence(company.ID, question, refresh)); }
    catch (e) { setError(e instanceof Error ? e.message : "Evidence retrieval failed."); }
    finally { setEvidenceBusy(false); }
  };

  const busy = starting || running || evidenceBusy;
  return <section className="company-section intel-company" id="company-intelligence">
    <div className="section-heading"><div><span className="section-marker">FERRUM INTELLIGENCE</span><h3>Research workbench</h3></div><span className="intel-badge">AI RESEARCH</span></div>
    <div className="intel-controls intel-workbench">
      <div className="intel-mode-options" role="group" aria-label="Research mode">
        {(Object.keys(modes) as ResearchMode[]).map(option => <button key={option} type="button" aria-pressed={mode === option}
          disabled={busy} onClick={() => { setMode(option); setEvidence(null); setError(""); }}>
          <b>{modes[option].label}</b><span>{modes[option].detail}</span>
        </button>)}
      </div>
      <label>Research focus<textarea disabled={busy} maxLength={500} value={question} onChange={event => setQuestion(event.target.value)} /></label>
      <div className="intel-buttons">
        <button className="compare-action" disabled={busy || (mode === "web" && status?.serpapi_configured === false)} onClick={generate}>{starting || running ? "Analysis running" : mode === "automated" ? "Run automated review" : "Generate research brief"}</button>
        {mode !== "workbook" && <button className="intel-secondary" disabled={busy || status?.serpapi_configured === false} onClick={checkEvidence}>{evidenceBusy ? "Searching…" : "Preview web evidence"}</button>}
        {mode !== "workbook" && <label className="intel-refresh"><input type="checkbox" checked={refresh} onChange={event => setRefresh(event.target.checked)} />Refresh web results</label>}
      </div>
      {status && !status.gemini_configured && <p className="intel-status">Gemini is offline. Ferrum will analyse the available evidence locally.</p>}
      {mode !== "workbook" && status && !status.serpapi_configured && <p className="intel-status">{mode === "web" ? "Configure SerpApi in the server settings to use Web only." : "Web search is unavailable. This review will use workbook evidence."}</p>}
      {running && <div className="intel-run-status" role="status"><div className="intel-run-steps" style={{ gridTemplateColumns: `repeat(${visibleStages.length}, minmax(0, 1fr))` }}>
        {visibleStages.map((stage, i) => <span key={stage} data-step={i === step ? "active" : i < step ? "done" : "waiting"}>{stageLabels[stage]}</span>)}
      </div><span>{run?.message}</span></div>}
      {(error || (run?.stage === "failed" && run.mode === mode)) && <p className="intel-error" role="alert">{error || run?.message}</p>}
    </div>
    {evidence && <EvidenceRoom preview sources={evidence.results} status={evidence.status} />}
    {running && report && <p className="intel-status">Showing the previous saved brief while this review runs.</p>}
    {report ? <BriefView key={report.snapshot_id} report={report} /> : !running && <p className="intel-empty">Create the first {modes[mode].label.toLowerCase()} brief for this company.</p>}
    {monitor?.state === "comparison_available" && monitor.latest?.mode === mode && <details className="intel-monitor intel-analysis-trace">
      <summary>Changes since the previous saved brief</summary>
      <p>{monitor.new_source_ids.length} newly seen sources / {monitor.no_longer_in_latest_search.length} prior sources absent from this search.</p>
      <p>{monitor.new_risk_statements.length} new risk statements / {monitor.new_external_findings.length} new external statements.</p>
      <small>{monitor.message}</small>
    </details>}
  </section>;
}

export function IntelligenceHub({ companies, onOpen }: { companies: Company[]; onOpen: (id:string)=>void }) {
  const desktop = useDesktopPresentation();
  const [selectedId,setSelectedId]=useState(companies[0]?.ID??""); const selected=useMemo(()=>companies.find(c=>c.ID===selectedId)??companies[0],[companies,selectedId]);
  const [status,setStatus]=useState<IntelligenceStatus|null>(null);
  useEffect(()=>{getIntelligenceStatus().then(setStatus).catch(()=>setStatus(null))},[]);
  return <section className="intel-hub"><header className="intel-hero"><span className="section-marker">FERRUM INTELLIGENCE · EVIDENCE-LED RESEARCH</span><h1>From evidence<br/><em>to interpretation.</em></h1><p>Company-specific external research synthesized alongside Ferrum&apos;s saved fundamental, technical and integrated analysis. Every update is explicit, dated and reviewable.</p></header><div className="intel-hub-controls"><label>Select company<select value={selected?.ID??""} onChange={e=>setSelectedId(e.target.value)}>{companies.map(c=><option key={c.ID} value={c.ID}>{c["Standardised Company Name"]} · {c["NSE Symbol (standardised)"]}</option>)}</select></label><div><span>Gemini</span><b>{status?.gemini_configured?status.gemini_model:"Not configured"}</b></div><div><span>SerpApi</span><b>{status?.serpapi_configured?"Configured":"Not configured"}</b></div>{selected&&<button className="compare-action" onClick={()=>onOpen(selected.ID)}>{desktop ? "Open company research" : "Open company research →"}</button>}</div>{selected&&<CompanyIntelligence key={selected.ID} company={selected}/>}</section>;
}

