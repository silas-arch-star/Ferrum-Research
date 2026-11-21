"""Resolve a brief's chart choices to auditable observations from the selected company."""

import math
import re
from dataclasses import dataclass

from backend.app.data_service import get_price_history
from backend.app.schemas import ChartSeries, ResearchChart
from backend.app.workbook_research import company_sheet_rows


@dataclass(frozen=True)
class Exhibit:
    title: str
    table: str
    unit: str
    fields: dict[str, str]
    topics: str


# Field names and unit conversions are owned here. The planner only selects IDs.
CATALOG = {
    "earnings": Exhibit("Sales and earnings", "annual", "Rs Cr", {"Revenue": "Revenue From Operations (Rs Cr)", "Operating profit": "Operating Profit (Rs Cr)", "Net profit": "Net Profit (Rs Cr)"}, "growth revenue sales earnings profits profitability"),
    "growth": Exhibit("Growth in sales and profit", "annual", "%", {"Sales growth": "Revenue Growth", "Operating profit growth": "Operating Profit Growth", "Net profit growth": "Net Profit Growth"}, "growth acceleration slowdown revenue sales earnings demand"),
    "cash_conversion": Exhibit("Operating cash conversion", "annual", "x", {"Cash flow / net profit": "CFO / Net Profit", "Cash flow / operating profit": "CFO / Operating Profit"}, "conversion accruals cash quality earnings"),
    "cash_quality": Exhibit("Cash behind reported profit", "annual", "Rs Cr", {"Operating cash flow": "Operating Cash Flow (Rs Cr)", "Net profit": "Net Profit (Rs Cr)"}, "cash earnings quality conversion dividend dividends payout"),
    "margins": Exhibit("Operating and net margins", "annual", "%", {"Operating margin": "Operating Margin (reported)", "Net margin": "Net Margin (reported)"}, "margin margins profitability costs earnings efficiency"),
    "debt": Exhibit("Borrowings and cash reserves", "annual", "Rs Cr", {"Borrowings": "Total Borrowings (Rs Cr)", "Cash and bank balances": "Cash & Bank Balances (Rs Cr)", "Net debt": "Net Debt (Rs Cr)"}, "debt leverage liquidity borrowing borrowings solvency refinancing cash"),
    "maturity": Exhibit("Borrowings by maturity", "annual", "Rs Cr", {"Short-term": "Short-term Borrowings (Rs Cr)", "Long-term": "Long-term Borrowings (Rs Cr)"}, "debt maturity refinancing default leverage borrowings"),
    "liquidity": Exhibit("Liquidity and leverage ratios", "annual", "x", {"Current ratio": "Current Ratio (x, reported)", "Debt / equity": "Debt/Equity (x, reported)"}, "debt liquidity leverage solvency balance sheet"),
    "interest": Exhibit("Finance costs against operating profit", "annual", "Rs Cr", {"Finance costs": "Finance Cost (Rs Cr)", "Operating profit": "Operating Profit (Rs Cr)"}, "interest coverage refinancing borrowing debt service"),
    "capital": Exhibit("Capital tied up in operations", "annual", "Rs Cr", {"Inventories": "Inventories (Rs Cr)", "Receivables": "Trade Receivables (Rs Cr)", "Payables": "Trade Payables (Rs Cr)"}, "capital inventory inventories collections receivables payables cycle liquidity"),
    "cash_flows": Exhibit("Sources and uses of cash", "annual", "Rs Cr", {"Operating": "Operating Cash Flow (Rs Cr)", "Investing": "Investing Cash Flow (Rs Cr)", "Financing": "Financing Cash Flow (Rs Cr)"}, "cash expansion investment investing capex capacity funding financing dividend"),
    "returns": Exhibit("Returns on capital and equity", "annual", "%", {"ROCE": "ROCE (reported)", "ROE": "ROE (reported)"}, "roce roe returns capital equity efficiency valuation profitability"),
    "eps": Exhibit("Earnings per share", "annual", "Rs/share", {"Basic EPS": "Basic EPS (Rs)"}, "eps shareholder earnings valuation dividend dividends payout"),
    "payout": Exhibit("Share of profit paid as dividends", "annual", "%", {"Dividend payout": "Dividend Payout (%)"}, "dividend dividends distribution shareholder yield payout"),
    "exports": Exhibit("Export exposure", "annual", "%", {"Export share of revenue": "Export Share of Revenue"}, "exports export trade tariff tariffs overseas international demand"),
    "market_cap": Exhibit("Market capitalisation", "Stock Market Data", "Rs Cr", {"Market value of equity": "Market Capitalisation"}, "valuation equity capitalisation capitalization size value"),
    "enterprise": Exhibit("Enterprise value", "Stock Market Ratio Data", "Rs Cr", {"Enterprise value": "Enterprise value"}, "valuation value acquisition takeover leverage"),
    "ev_multiple": Exhibit("Enterprise value relative to earnings", "Stock Market Ratio Data", "x", {"EV / PBDITA": "Enterprise Value / PBDITA"}, "valuation multiple multiples expensive cheap enterprise ebitda pbdita"),
    "ownership": Exhibit("Promoter and listed non-promoter holdings", "Ownership Analysis", "%", {"Promoter holding": "Promoter Holding", "Listed non-promoter holding": "Listed Non-Promoter Holding"}, "promoters promoter ownership holders holding concentration dilution control float shareholding"),
    "holders": Exhibit("Shares held by promoters", "Ownership Analysis", "shares", {"Promoter shares": "Promoter Shares"}, "ownership promoters promoter holders holding dilution shareholding"),
    "concentration": Exhibit("Ownership concentration in disclosed holdings", "ownership_snapshot", "%", {"Largest named holder": "Largest Named Holder Latest (%)", "All named holders": "Named-Holder Coverage Latest (Promoter + Listed Non-Promoter, %)"}, "ownership concentration shareholder holders promoter control"),
    "holding_change": Exhibit("Change in disclosed ownership", "ownership_snapshot", "pp", {"Promoters": "Promoter Change (pp)", "Listed non-promoters": "Non-Promoter Change (pp)"}, "ownership change stake dilution holding holders shareholding"),
    "profile": Exhibit("Fundamental score profile", "scores", "/ 100", {"Profitability": "Profitability Score", "Growth": "Growth Score", "Financial strength": "Financial Strength Score", "Valuation": "Valuation Score"}, "valuation score ranking strengths weaknesses quality"),
    "momentum": Exhibit("Returns across holding periods", "market", "%", {"20 sessions": "20D Price Return", "3 months": "3M Return", "6 months": "6M Return", "1 year": "1Y Return"}, "price momentum trend technical return returns performance"),
    "benchmark": Exhibit("Return relative to Nifty Metals", "market", "pp", {"3 months": "3M vs Nifty Metals (pp)", "6 months": "6M vs Nifty Metals (pp)", "1 year": "1Y vs Nifty Metals (pp)"}, "index benchmark relative outperform outperformance market peers momentum"),
    "price": Exhibit("Price and moving averages", "daily", "Rs/share", {"Close": "close", "20-session SMA": "sma20", "50-session SMA": "sma50"}, "price technical trend sma moving averages breakout support resistance momentum"),
    "rsi": Exhibit("Relative strength index", "daily", "/ 100", {"14-session RSI": "rsi"}, "rsi overbought oversold strength technical momentum"),
    "macd": Exhibit("MACD and its signal line", "daily", "points", {"MACD": "macd", "Signal": "macd_signal"}, "macd signal crossover divergence technical momentum"),
    "volume": Exhibit("Daily trading volume", "daily", "shares", {"Volume": "volume"}, "volume activity participation trading breakout momentum"),
}
OVERVIEW = ("earnings", "debt", "returns", "momentum")

# A narrowly worded question can still have several complementary measures.
RELATED = (
    ("debt", "maturity", "liquidity", "interest"),
    ("payout", "eps", "cash_quality", "cash_flows"),
    ("cash_conversion", "cash_quality", "cash_flows", "capital"),
    ("growth", "earnings", "margins", "returns"),
    ("exports", "growth", "earnings", "margins"),
    ("rsi", "macd", "momentum", "price", "volume", "benchmark"),
    ("profile", "returns", "eps", "margins"),
    ("ev_multiple", "enterprise", "market_cap", "eps"),
    ("ownership", "holders", "concentration", "holding_change"),
)


def suggested_exhibits(question: str) -> list[str]:
    words = set(re.findall(r"[a-z]+", question.casefold()))
    scores = {key: len(words.intersection(spec.topics.split())) for key, spec in CATALOG.items()}
    direct = sorted((key for key in CATALOG if scores[key]), key=scores.get, reverse=True)
    if not direct:
        return []
    # If direct matches run out, supplement with related measures from the closest family.
    family = max(RELATED, key=lambda group: sum(scores[key] for key in group) / len(group))
    return list(dict.fromkeys([*direct, *family]))


def financial_records(company: dict, sheet: str) -> list[dict]:
    raw = company_sheet_rows(company, "IA - Fundamental Analysis.xlsx", sheet)
    if sheet == "Ownership Analysis":
        if not raw:
            return []
        row = raw[0]
        return [
            {"period": str(row[stage + " Snapshot Date"])[:10],
             "Promoter Holding": row.get(f"Promoter Holding {stage} (%)"),
             "Listed Non-Promoter Holding": row.get(f"Listed Non-Promoter Holding {stage} (%)"),
             "Promoter Shares": row.get(f"Promoter Shares {stage}")}
            for stage in ("Earlier", "Latest") if row.get(stage + " Snapshot Date")
        ]
    by_period = {}
    for row in raw:
        if row.get("Fiscal Year") and row.get("Metric"):
            period = row["Fiscal Year"]
            by_period.setdefault(period, {"period": period})[row["Metric"]] = row.get("Value")
    return [by_period[period] for period in sorted(by_period)]


def build_charts(company, question, choices=None):
    if choices is None:
        choices = suggested_exhibits(question)
    related = sorted(RELATED, key=lambda group: sum(key in choices for key in group), reverse=True)
    supplements = [key for group in related if any(item in choices for item in group) for key in group]
    selected = []
    history = None
    for key in dict.fromkeys([*choices, *supplements, *OVERVIEW, *CATALOG]):
        spec = CATALOG.get(key)
        if spec is None:
            continue
        factor = 100 if spec.unit in {"%", "pp"} else 1

        def value(row, field):
            raw = row.get(field)
            return raw * factor if type(raw) in (int, float) and math.isfinite(raw) else None

        categorical = spec.table in {"market", "scores", "ownership_snapshot"}
        if not categorical:
            if spec.table == "annual":
                label = "Fiscal Year"
                records = sorted(company.get("fundamental_trends") or [], key=lambda row: str(row.get(label, "")))
                source = "Fundamental analysis · Five-Year Trends"
            elif spec.table == "daily":
                if history is None:
                    history = sorted(get_price_history(company["ID"])["points"], key=lambda row: row["date"])[-60:]
                records, label = history, "date"
                source = "Technical analysis · Daily prices and indicators"
            else:
                records, label = financial_records(company, spec.table), "period"
                source = "Fundamental analysis · " + spec.table
            records = [row for row in records if row.get(label)]
            fields = [(name, field) for name, field in spec.fields.items() if sum(value(r, field) is not None for r in records) >= 2]
            if not fields:
                continue
            series = [ChartSeries(key=f"v{i}", name=name) for i, (name, _) in enumerate(fields)]
            rows = [{"label": str(row[label])[:10] if label == "date" else str(row[label]),
                     **{item.key: value(row, field) for item, (_, field) in zip(series, fields)}} for row in records if row.get(label)]
            period = f"{rows[0]['label']} – {rows[-1]['label']}"
        else:
            if spec.table == "market":
                record = company.get("technical_research") or {}
                period = str(record.get("Latest Date") or "")[:10]
                source = "Technical analysis · Technical Scorecard"
            elif spec.table == "ownership_snapshot":
                records = company_sheet_rows(company, "IA - Fundamental Analysis.xlsx", "Ownership Analysis")
                record = records[0] if records else {}
                dates = ("Earlier Snapshot Date", "Latest Snapshot Date") if key == "holding_change" else ("Latest Snapshot Date",)
                period = " – ".join(str(record[field])[:10] for field in dates if record.get(field))
                source = "Fundamental analysis · Ownership Analysis"
            else:
                record = company.get("fundamental_scorecard") or {}
                period = str((company.get("fundamental_trends") or [{}])[-1].get("Fiscal Year") or "")
                source = "Fundamental analysis · Fundamental Ranking"
            rows = [{"label": name, "v0": value(record, field)} for name, field in spec.fields.items() if value(record, field) is not None]
            if len(rows) < 2:
                continue
            measure = {"benchmark": "Excess return", "momentum": "Price return", "profile": "Component score",
                       "concentration": "Share of equity", "holding_change": "Change in holding"}[key]
            series = [ChartSeries(key="v0", name=measure)]
        selected.append(ResearchChart(id=key, title=spec.title, source=source, period=period, unit=spec.unit,
                                      kind="bar" if categorical or key == "volume" else "line",
                                      context=key not in choices, series=series, rows=rows))
        if len(selected) == 4:
            break
    return selected
