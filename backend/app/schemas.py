from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

Cell = str | int | float | None
WorkbookRow = dict[str, Cell]


class CompanyResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    company_id: str = Field(alias="ID")
    name: str = Field(alias="Standardised Company Name")
    symbol: str = Field(alias="NSE Symbol (standardised)")
    peer_group: str = Field(alias="Peer Group (analyst assumption, fundamental workbook)")
    subsector: str = Field(alias="Subsector (analyst assumption, fundamental workbook)")
    data_limitations: str | None = Field(alias="Data Availability & Material Limitations")
    integrated_scorecard: WorkbookRow | None
    fundamental_research: WorkbookRow | None
    fundamental_scorecard: WorkbookRow | None
    fundamental_trends: list[WorkbookRow] = Field(default_factory=list)
    technical_research: WorkbookRow | None
    technical_insight: WorkbookRow | None


class CompanyListResponse(BaseModel):
    count: int
    companies: list[CompanyResponse]


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    category: str = Field(alias="Category")
    selected_company: str = Field(alias="Selected Company (model, eligible only)")
    model_score: float | None = Field(alias="Model Score (0-100)")
    eligible_candidates: int | None = Field(alias="Eligible Candidates (of 20)")


class RecommendationListResponse(BaseModel):
    count: int
    recommendations: list[RecommendationResponse]


class PricePoint(BaseModel):
    date: str
    close: float
    rsi: float | None
    volume: float | None
    sma20: float | None = None
    sma50: float | None = None
    sma200: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None


class PriceHistoryResponse(BaseModel):
    company_id: str
    symbol: str
    points: list[PricePoint]


class SectorResearchResponse(BaseModel):
    source: str
    paragraphs: list[str]
    factors: list[WorkbookRow] = Field(default_factory=list)


ResearchMode = Literal["focused", "automated", "workbook", "web"]


class ResearchQuestion(BaseModel):
    question: str = Field(default="What recent developments could materially affect this company's existing investment thesis?", max_length=500)
    refresh: bool = False
    mode: ResearchMode = "focused"


class EvidenceSource(BaseModel):
    source_id: str
    title: str
    url: str
    domain: str
    snippet: str
    published_at: str | None = None
    retrieved_at: str
    topic: str
    source_type: str
    verification_status: str


class EvidenceResponse(BaseModel):
    status: Literal["success", "empty", "failed", "not_configured", "not_requested"]
    query: str
    retrieved_at: str
    results: list[EvidenceSource] = Field(default_factory=list)
    error_category: str | None = None


class BriefClaim(BaseModel):
    text: str
    basis: Literal["external_fact", "internal_fact", "calculation", "interpretation"]
    source_ids: list[str] = Field(default_factory=list)
    internal_references: list[str] = Field(default_factory=list)


class ResearchBrief(BaseModel):
    status: Literal["complete", "partial", "insufficient_evidence"]
    executive_conclusion: str
    current_thesis: str
    supporting_findings: list[BriefClaim] = Field(default_factory=list)
    contradictory_evidence: list[BriefClaim] = Field(default_factory=list)
    bull_case: list[BriefClaim] = Field(default_factory=list)
    bear_case: list[BriefClaim] = Field(default_factory=list)
    risks: list[BriefClaim] = Field(default_factory=list)
    catalysts: list[BriefClaim] = Field(default_factory=list)
    internal_interpretation: list[BriefClaim] = Field(default_factory=list)
    external_developments: list[BriefClaim] = Field(default_factory=list)
    thesis_implications: list[BriefClaim] = Field(default_factory=list)
    conflicts: list[BriefClaim] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    confidence_label: Literal["low", "moderate", "high"]
    confidence_basis: str


class ChartSeries(BaseModel):
    key: str
    name: str


class ResearchChart(BaseModel):
    id: str
    title: str
    kind: Literal["line", "bar"]
    unit: str
    source: str
    period: str
    context: bool
    series: list[ChartSeries]
    rows: list[dict[str, str | float | None]]


class ResearchSnapshot(BaseModel):
    snapshot_id: str
    company_id: str
    company_name: str
    question: str
    generated_at: str
    model: str
    internal_data_as_of: str | None = None
    evidence_status: str
    sources: list[EvidenceSource] = Field(default_factory=list)
    brief: ResearchBrief
    citation_warnings: list[str] = Field(default_factory=list)
    mode: ResearchMode = "focused"
    workbook_reads: list["WorkbookRead"] = Field(default_factory=list)
    searches: list["SearchTrace"] = Field(default_factory=list)
    synthesis: Literal["gemini", "source_digest", "local_analysis"] = "gemini"
    synthesis_note: str | None = None
    charts: list[ResearchChart] = Field(default_factory=list)


class WorkbookRead(BaseModel):
    reference: str
    workbook: str
    sheet: str
    scope: Literal["company", "sheet"]
    records: int
    available: int


class SearchTrace(BaseModel):
    query: str
    status: str
    results: int


class ResearchRun(BaseModel):
    mode: ResearchMode = "focused"
    question: str = ""
    refresh: bool = False
    id: str
    company_id: str
    stage: Literal["queued", "reading", "planning", "searching", "writing", "complete", "failed"]
    message: str
    snapshot: ResearchSnapshot | None = None


class ProviderStatus(BaseModel):
    gemini_configured: bool
    gemini_model: str
    serpapi_configured: bool


class ThesisMonitor(BaseModel):
    state: Literal["first_research", "comparison_available"]
    message: str
    previous: ResearchSnapshot | None = None
    latest: ResearchSnapshot | None = None
    new_source_ids: list[str] = Field(default_factory=list)
    no_longer_in_latest_search: list[str] = Field(default_factory=list)
    new_risk_statements: list[str] = Field(default_factory=list)
    risk_statements_not_repeated: list[str] = Field(default_factory=list)
    new_external_findings: list[str] = Field(default_factory=list)
    external_findings_not_repeated: list[str] = Field(default_factory=list)
