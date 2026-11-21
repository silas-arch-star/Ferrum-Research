from backend.app.intelligence import _validate_claims, normalize_results, thesis_monitor
import asyncio

import httpx
import pytest
from fastapi import HTTPException

from backend.app import intelligence
from backend.app.schemas import BriefClaim, EvidenceResponse, EvidenceSource, ResearchBrief, ResearchQuestion, ResearchSnapshot
from backend.app.data_service import get_company
from backend.app.workbook_research import ReadRequest, catalog, read_workbooks


def test_automated_review_preserves_evidence_when_synthesis_fails(monkeypatch):
    async def search(query, _refresh):
        source = EvidenceSource(source_id="filing-one", title="Filing excerpt", url="https://example.com/filing",
                                domain="example.com", snippet="Results excerpt", retrieved_at="now",
                                topic=query, source_type="other", verification_status="unverified")
        return EvidenceResponse(status="success", query=query, retrieved_at="now", results=[source])

    async def unavailable(*_args):
        raise httpx.ReadTimeout("provider timeout")

    captured = []
    monkeypatch.setattr(intelligence, "_search_query", search)
    monkeypatch.setattr(intelligence, "_structured", unavailable)
    monkeypatch.setattr(intelligence, "_save_snapshot", captured.append)
    monkeypatch.setattr(intelligence, "get_settings", lambda: type("Settings", (), {"gemini_api_key": "test", "gemini_model": "test"})())
    snapshot = asyncio.run(intelligence.update_research("C01", ResearchQuestion(mode="automated", refresh=True)))
    assert snapshot.synthesis == "local_analysis"
    assert len(snapshot.charts) == 4
    assert snapshot.brief.status == "partial"
    assert len(snapshot.searches) == 3 and len(snapshot.sources) == 1
    assert len(snapshot.workbook_reads) > 6
    assert all(claim.internal_references for claim in snapshot.brief.supporting_findings)
    assert captured == [snapshot]


def test_workbook_library_can_read_integrated_summaries_and_company_scope():
    company = get_company("C01")
    sheets = catalog(company)
    summaries = [item for item in sheets if item["sheet"] in {"02_Fundamental_Summary", "03_Technical_Summary"}]
    assert len(summaries) == 2
    assert all(item["company_rows"] >= 1 and item["saved_rows"] > 1 for item in summaries)
    requests = [ReadRequest(sheet_id=item["sheet_id"], scope="company", limit=1, fields=["NSE Symbol"]) for item in summaries]
    records, trace = read_workbooks(company, sheets, requests)
    assert len(trace) > len(requests)
    assert all(record["rows"] == [{"NSE Symbol": "JSWSTEEL"}] for record in records[:2])


def test_draft_maps_evidence_keys_to_their_original_sources():
    draft = intelligence.CitedDraft(
        executive_conclusion="Conclusion", current_thesis="Thesis", unknowns=[], confidence_label="moderate",
        confidence_basis="Workbook and search evidence.",
        findings=[
            {"section": "supporting_findings", "text": "Workbook observation", "basis": "fact", "citations": ["W1"]},
            {"section": "external_developments", "text": "Web observation", "basis": "fact", "citations": ["S1"]},
            {"section": "risks", "text": "Unsupported", "basis": "fact", "citations": ["S2"]},
        ],
    )
    brief = intelligence._resolve_draft(draft, {"W1": "internal:sheet"}, {"S1": "source-id"})
    assert brief.supporting_findings == [BriefClaim(text="Workbook observation", basis="internal_fact", internal_references=["internal:sheet"])]
    assert brief.external_developments == [BriefClaim(text="Web observation", basis="external_fact", source_ids=["source-id"])]
    assert not brief.risks
    with pytest.raises(ValueError, match="did not cite"):
        intelligence._resolve_draft(draft, {"W2": "internal:other"}, {"S1": "source-id"})


@pytest.mark.parametrize("mode", ["automated", "focused", "workbook", "web"])
def test_provider_outage_preserves_only_the_requested_sources(mode, monkeypatch, tmp_path):
    async def search(query, _refresh):
        source = EvidenceSource(source_id="source-1", title="Filing", url="https://example.com/results",
                                domain="example.com", snippet="An extract from the issuer.", retrieved_at="now",
                                topic=query, source_type="other", verification_status="unverified")
        assert mode != "workbook", "Workbook-only requests must skip web search"
        return EvidenceResponse(status="success", query=query, retrieved_at="now", results=[source])

    monkeypatch.setattr(intelligence, "DB_PATH", tmp_path / "test.sqlite3")
    monkeypatch.setattr(intelligence, "get_settings", lambda: type("Settings", (), {"gemini_api_key": None, "gemini_model": "test"})())
    monkeypatch.setattr(intelligence, "_search_query", search)
    snapshot = asyncio.run(intelligence.update_research("C20", ResearchQuestion(mode=mode)))
    assert snapshot.synthesis == "local_analysis"
    assert bool(snapshot.brief.supporting_findings) == (mode != "web")
    assert bool(snapshot.brief.external_developments) == (mode != "workbook")
    assert bool(snapshot.workbook_reads) == (mode in {"workbook", "automated"})
    assert len(snapshot.charts) == (4 if mode == "automated" else 0)
    assert intelligence.latest_research("C20", mode) == snapshot
    other_mode = "workbook" if mode == "web" else "web"
    assert intelligence.latest_research("C20", other_mode) is None


def test_web_only_with_empty_search_preserves_saved_history(monkeypatch):
    async def empty(*args, **kwargs):
        return EvidenceResponse(status="empty", query="question", retrieved_at="now")

    monkeypatch.setattr(intelligence, "search_evidence", empty)
    monkeypatch.setattr(intelligence, "_save_snapshot", lambda _: pytest.fail("An empty web search cannot replace a report"))
    with pytest.raises(HTTPException) as failure:
        asyncio.run(intelligence.update_research("C01", ResearchQuestion(mode="web")))
    assert failure.value.detail["category"] == "empty"


def test_normalize_sources_deduplicates_and_keeps_dates_distinct():
    payload = {"organic_results": [
        {"title": "Quarterly results", "link": "https://example.com/results?utm_source=google", "snippet": "Results excerpt", "date": "2026-10-01"},
        {"title": "Quarterly results", "link": "https://example.com/results", "snippet": "Duplicate"},
        {"title": "Unsafe link", "link": "http://example.com/a", "snippet": "Not kept"},
    ]}
    results = normalize_results(payload, "query", "2026-10-18T00:00:00+00:00")
    assert len(results) == 1
    assert results[0].published_at == "2026-10-01"
    assert results[0].retrieved_at == "2026-10-18T00:00:00+00:00"
    assert "utm_" not in results[0].url


def test_citation_validation_drops_invalid_external_and_internal_claims():
    source = EvidenceSource(source_id="valid", title="t", url="https://example.com", domain="example.com", snippet="s", retrieved_at="now", topic="q", source_type="other", verification_status="unverified")
    brief = ResearchBrief(status="complete", executive_conclusion="c", current_thesis="t", confidence_label="low", confidence_basis="thin coverage",
        external_developments=[BriefClaim(text="unsupported", basis="external_fact", source_ids=["invented"]), BriefClaim(text="supported", basis="external_fact", source_ids=["valid"])],
        internal_interpretation=[BriefClaim(text="bad ref", basis="internal_fact", internal_references=["made-up"])])
    warnings = _validate_claims(brief, [source], ["internal:workbook/sheet"])
    assert [claim.text for claim in brief.external_developments] == ["supported"]
    assert brief.internal_interpretation == []
    assert len(warnings) >= 2


def test_thesis_monitor_without_saved_snapshots_has_first_research_state(monkeypatch):
    monkeypatch.setattr("backend.app.intelligence.research_history", lambda _company_id, mode=None: [])
    result = thesis_monitor("C01")
    assert result.state == "first_research"
    assert result.latest is None


def test_thesis_monitor_compares_real_source_ids_and_exact_claim_text(monkeypatch):
    def snapshot(snapshot_id, source_id, risk):
        source = EvidenceSource(source_id=source_id, title="t", url=f"https://example.com/{source_id}", domain="example.com", snippet="s", retrieved_at="now", topic="q", source_type="other", verification_status="unverified")
        brief = ResearchBrief(status="complete", executive_conclusion="c", current_thesis="t", confidence_label="low", confidence_basis="limited", risks=[BriefClaim(text=risk, basis="interpretation")])
        return ResearchSnapshot(snapshot_id=snapshot_id, company_id="C01", company_name="Example", question="q", generated_at="now", model="test", evidence_status="success", sources=[source], brief=brief)
    rows = [snapshot("new", "source-new", "New risk"), snapshot("old", "source-old", "Prior risk")]
    monkeypatch.setattr("backend.app.intelligence.research_history", lambda _company_id, mode=None: rows)
    result = thesis_monitor("C01")
    assert result.state == "comparison_available"
    assert result.new_source_ids == ["source-new"]
    assert result.no_longer_in_latest_search == ["source-old"]
    assert result.new_risk_statements == ["New risk"]
    assert result.risk_statements_not_repeated == ["Prior risk"]

