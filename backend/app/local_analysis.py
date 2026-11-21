"""Generate an attributable review from Ferrum's sources during a model outage."""

import re

from backend.app.schemas import BriefClaim, ResearchBrief


def _words(text):
    return set(re.findall(r"[a-z0-9]+", text.casefold()))


def _period_changes(company, reference):
    years = sorted(company.get("fundamental_trends") or [], key=lambda row: str(row.get("Fiscal Year") or ""))
    if not reference or len(years) < 2:
        return []
    previous, latest = years[-2:]
    changes = []
    for field, label in (("Net Profit (Rs Cr)", "Net profit"), ("Operating Cash Flow (Rs Cr)", "Operating cash flow"),
                         ("Revenue From Operations (Rs Cr)", "Revenue from operations"), ("Net Debt (Rs Cr)", "Net debt")):
        before, after = previous.get(field), latest.get(field)
        if not all(isinstance(value, (int, float)) for value in (before, after)):
            continue
        move = after - before
        change = f"{'up' if move > 0 else 'down'} Rs {abs(move):,.1f} crore" if move else "unchanged"
        text = (f"{label} was Rs {after:,.1f} crore in {latest['Fiscal Year']}, {change} "
                f"from Rs {before:,.1f} crore in {previous['Fiscal Year']}.")
        changes.append(BriefClaim(text=text, basis="calculation", internal_references=[reference]))
    return changes


_WEB_TOPICS = {
    "earnings and results": {"earnings", "results", "margin", "profit", "revenue", "ebitda"},
    "investment and capacity": {"capex", "capacity", "expansion", "production", "commissioning"},
    "financing and liquidity": {"liquidity", "debt", "borrowing", "credit", "rating", "financing"},
    "regulation and trade": {"tariff", "tariffs", "duty", "duties", "regulatory", "imports", "exports"},
    "valuation": {"valuation", "valuations", "multiple", "multiples"},
}


def _web_findings(sources, terms):
    by_topic = []
    for topic, keywords in _WEB_TOPICS.items():
        matched = [s for s in sources if keywords & _words(s.title + " " + s.snippet)]
        if matched:
            domains = {s.domain for s in matched}
            by_topic.append((len(terms & keywords), len(domains), len(matched), topic, matched))
    by_topic.sort(key=lambda row: row[:3], reverse=True)
    coverage = [BriefClaim(
        text=f"{len(matches)} retrieved {'record' if len(matches) == 1 else 'records'} from "
             f"{domains} {'domain' if domains == 1 else 'domains'} {'mentions' if len(matches) == 1 else 'mention'} {topic}.",
        basis="interpretation", source_ids=[s.source_id for s in matches],
    ) for _, domains, _, topic, matches in by_topic[:2]]
    ranked = sorted(sources, key=lambda s: len(terms & _words(s.title + " " + s.snippet)), reverse=True)
    excerpts = [BriefClaim(text=f"{s.domain} — {s.snippet or s.title}", basis="external_fact", source_ids=[s.source_id])
                for s in ranked[:3]]
    return coverage, excerpts


def compile_evidence(company, refs, evidence, question):
    terms = _words(question)
    facts = _period_changes(company, refs.get("fundamental_trends"))

    def observations(section, fields, basis="internal_fact"):
        row = company.get(section) or {}
        return [BriefClaim(text=str(row[field]), basis=basis, internal_references=[refs[section]])
                for field in fields if section in refs and row.get(field)]

    facts += observations("fundamental_research", ["Financial Strength & Cash Flow (FACTS from workbook)",
                           "Valuation & Ownership (FACTS from workbook)", "Profitability & Growth (FACTS from workbook)"])
    facts += observations("technical_insight", ["Momentum (RSI / MACD)", "Returns & Relative Performance", "Trend & Moving Averages"])
    # Weight specific question terms over common prose in longer workbook paragraphs.
    keywords = {word for word in terms if len(word) > 3} - {"what", "with", "from", "between", "company", "recent", "which", "this"}
    facts.sort(key=lambda claim: len(keywords & _words(claim.text)), reverse=True)
    risks = observations("integrated_scorecard", ["Overall Risk Flags (detail)"])
    conflicts = observations("integrated_scorecard", ["Key Contradictions: Fundamental vs Technical"], "interpretation")
    assessment = observations("integrated_scorecard", ["Concise Integrated Assessment"], "interpretation")
    coverage, excerpts = _web_findings(evidence.results, terms)
    highlights = [group[0].text for group in (facts, coverage or excerpts) if group]
    limits = []
    if evidence.results:
        limits.append("Web findings describe retrieved titles and excerpts. Full filings may contain qualifications.")
    elif evidence.status != "not_requested":
        limits.append("No public evidence was retrieved for this review.")
    if not any(keywords & _words(claim.text) for claim in facts + excerpts):
        limits.append("The available evidence does not directly address the wording of the question.")
    return ResearchBrief(
        status="partial", executive_conclusion=" ".join(highlights) or "There is insufficient evidence to answer the question.",
        current_thesis=assessment[0].text if assessment else (excerpts[0].text if excerpts else "No thesis could be established."),
        supporting_findings=facts[:3], internal_interpretation=assessment, contradictory_evidence=conflicts,
        risks=risks, external_developments=excerpts, thesis_implications=coverage, unknowns=limits,
        confidence_label="low", confidence_basis="Ferrum compared the available records locally. The interpretation is limited to the cited observations.",
    )
