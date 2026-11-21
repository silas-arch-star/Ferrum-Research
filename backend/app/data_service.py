from functools import lru_cache
from pathlib import Path
from typing import Any
import re

from fastapi import HTTPException
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
WORKBOOK = ROOT / "data" / "source" / "IA - Integrated Analysis.xlsx"
FUNDAMENTAL_WORKBOOK = ROOT / "data" / "source" / "IA - Fundamental Analysis.xlsx"
TECHNICAL_WORKBOOK = ROOT / "data" / "source" / "IA - Technical Analysis.xlsx"
SECTOR_TEXT = ROOT / "data" / "processed" / "sector_research.txt"
SOURCE_WORKBOOKS = {
    "IA - Fundamental Analysis.xlsx": FUNDAMENTAL_WORKBOOK,
    "IA - Technical Analysis.xlsx": TECHNICAL_WORKBOOK,
    "IA - Integrated Analysis.xlsx": WORKBOOK,
}


def clean(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, float) and not (value == value):
        return None
    return value


def read_records(sheet_name: str) -> list[dict[str, Any]]:
    workbook = load_workbook(WORKBOOK, read_only=True, data_only=True)
    try:
        sheet = workbook[sheet_name]
        rows = sheet.iter_rows(values_only=True)
        header_row = None
        records = []

        for row in rows:
            values = [clean(value) for value in row]
            if header_row is None:
                if sheet_name == "01_Company_Master" and any(
                    str(v).strip() == "ID" for v in values if v is not None
                ):
                    header_row = [str(v).strip() if v is not None else "" for v in values]
                elif sheet_name != "01_Company_Master" and any(
                    str(v).strip() in {"Company", "Category"}
                    for v in values if v is not None
                ):
                    header_row = [str(v).strip() if v is not None else "" for v in values]
                continue

            if not any(value is not None for value in values):
                continue

            record = {
                header_row[i]: values[i]
                for i in range(min(len(header_row), len(values)))
                if header_row[i]
            }

            if sheet_name == "01_Company_Master":
                if record.get("ID") and record.get("Standardised Company Name"):
                    records.append(record)
            elif sheet_name == "05_Integrated_Scorecard":
                if record.get("Company"):
                    records.append(record)
            elif sheet_name == "07_Stock_Selection":
                if record.get("Category") and record.get("Selected Company (model, eligible only)"):
                    records.append(record)

        return records
    finally:
        workbook.close()


def read_table(path: Path, sheet_name: str, header_row: int) -> list[dict[str, Any]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook[sheet_name]
        rows = sheet.iter_rows(values_only=True)
        for _ in range(header_row - 1):
            if next(rows, None) is None:
                return []
        header_values = next(rows, None)
        if header_values is None:
            return []
        headers = [clean(value) for value in header_values]
        records = []
        for row in rows:
            values = [clean(value) for value in row]
            if not any(value is not None for value in values):
                continue
            records.append({str(headers[i]).strip(): values[i]
                            for i in range(min(len(headers), len(values)))
                            if headers[i] is not None and str(headers[i]).strip()})
        return records
    finally:
        workbook.close()


def name_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())


def _rows_for_sheet(workbook, sheet_name: str) -> tuple[list[str], list[dict[str, Any]]]:
    """Read a saved-value worksheet using its real header, never evaluating formulas."""
    sheet = workbook[sheet_name]
    header_index = None
    headers: list[str] = []
    for index, row in enumerate(sheet.iter_rows(min_row=1, max_row=min(sheet.max_row, 12), values_only=True)):
        values = [clean(value) for value in row]
        labels = {str(value).strip() for value in values if value is not None}
        if labels.intersection({"Company", "Company Name", "Company (standardised)", "Standardised Company Name", "ID", "Category", "Instrument", "Instrument Name", "Column Name", "Parameter", "Item", "Area"}):
            header_index = index + 1
            headers = [str(value).strip() if value is not None else "" for value in values]
            break
    if header_index is None:
        return [], []
    records: list[dict[str, Any]] = []
    for row in sheet.iter_rows(min_row=header_index + 1, values_only=True):
        values = [clean(value) for value in row]
        if not any(value is not None for value in values):
            continue
        records.append({headers[i]: values[i] for i in range(min(len(headers), len(values))) if headers[i]})
    return headers, records


def _company_names(company: dict[str, Any]) -> set[str]:
    return {
        name_key(company.get("ID")),
        name_key(company.get("Standardised Company Name")),
        name_key(company.get("Name in Fundamental Workbook")),
        name_key(company.get("Name in Technical Workbook")),
    } - {""}


@lru_cache
def _source_records() -> dict[str, dict[str, tuple[list[str], list[dict[str, Any]]]]]:
    result: dict[str, dict[str, tuple[list[str], list[dict[str, Any]]]]] = {}
    for source_name, path in SOURCE_WORKBOOKS.items():
        workbook = load_workbook(path, read_only=True, data_only=True)
        try:
            result[source_name] = {
                sheet.title: _rows_for_sheet(workbook, sheet.title)
                for sheet in workbook.worksheets
            }
        finally:
            workbook.close()
    return result


def _matches_company(row: dict[str, Any], names: set[str], symbols: set[str]) -> bool:
    for key in ("ID", "Company", "Company Name", "Company (standardised)", "Standardised Company Name", "Instrument", "Instrument Name", "Selected Company (model, eligible only)"):
        if name_key(row.get(key)) in names:
            return True
    for key in ("NSE Symbol", "NSE Symbol (standardised)", "NSE Symbol in Fundamental Workbook", "NSE Symbol in Technical Workbook"):
        value = str(row.get(key) or "").strip().upper()
        if value and value in symbols:
            return True
    return False


def get_company_research(company_id: str) -> dict[str, Any]:
    company = get_company(company_id)
    names = _company_names(company)
    symbols = {
        str(company.get(key) or "").strip().upper()
        for key in ("NSE Symbol (standardised)", "NSE Symbol in Fundamental Workbook", "NSE Symbol in Technical Workbook")
    } - {""}
    sections = []
    for source_name, sheets in _source_records().items():
        for sheet_name, (fields, rows) in sheets.items():
            matched = [row for row in rows if _matches_company(row, names, symbols)]
            if matched:
                sections.append({"source": source_name, "sheet": sheet_name, "fields": fields, "rows": matched})
    return {"company_id": company["ID"], "company_name": company["Standardised Company Name"], "sections": sections}


def get_source_inventory() -> dict[str, Any]:
    inventory = []
    references = []
    reference_sheets = {
        ("IA - Fundamental Analysis.xlsx", "Data Quality & Dictionary"),
        ("IA - Technical Analysis.xlsx", "Data Quality Notes"),
        ("IA - Technical Analysis.xlsx", "Data Dictionary"),
        ("IA - Technical Analysis.xlsx", "Technical Ranking"),
        ("IA - Technical Analysis.xlsx", "Audit Log"),
        ("IA - Integrated Analysis.xlsx", "06_Selection_Criteria"),
        ("IA - Integrated Analysis.xlsx", "04_Sector_Context"),
        ("IA - Integrated Analysis.xlsx", "08_Final_Recommendation"),
        ("IA - Integrated Analysis.xlsx", "10_ESG_Analysis"),
    }
    for source_name, sheets in _source_records().items():
        for sheet_name, (fields, rows) in sheets.items():
            company_fields = ("Company", "Company Name", "Company (standardised)", "Standardised Company Name", "Instrument", "Instrument Name")
            date_fields = ("Date", "Latest Date", "Fiscal Year", "Holding Date")
            companies = sorted({str(row.get(key)).strip() for row in rows for key in company_fields if row.get(key) is not None})
            dates = sorted({str(row.get(key))[:10] for row in rows for key in date_fields if row.get(key) is not None})
            inventory.append({
                "source": source_name,
                "sheet": sheet_name,
                "fields": fields,
                "records": len(rows),
                "company_count": len(companies),
                "date_start": dates[0] if dates else None,
                "date_end": dates[-1] if dates else None,
                "missing_cells": sum(value is None for row in rows for value in row.values()),
            })
            if (source_name, sheet_name) in reference_sheets:
                unique_rows = []
                seen = set()
                for row in rows:
                    identity = tuple(str(row.get(field, "")) for field in fields)
                    if not any(identity) or identity in seen:
                        continue
                    seen.add(identity)
                    unique_rows.append(row)
                    if len(unique_rows) >= 200:
                        break
                references.append({"source": source_name, "sheet": sheet_name, "fields": fields, "rows": unique_rows})
    return {"sources": inventory, "references": references}


@lru_cache
def get_research_data() -> dict[str, Any]:
    if not WORKBOOK.is_file():
        raise FileNotFoundError(f"Integrated workbook not found: {WORKBOOK}")

    companies = read_records("01_Company_Master")
    scorecard = read_records("05_Integrated_Scorecard")
    recommendations = read_records("07_Stock_Selection")

    fundamentals = read_table(FUNDAMENTAL_WORKBOOK, "Company Fundamental Insights", 2)
    # Fundamental Scorecard contains later audit/support tables beneath its first
    # table. Fundamental Ranking is the authoritative one-row-per-company output.
    fundamental_scores = read_table(FUNDAMENTAL_WORKBOOK, "Fundamental Ranking", 2)
    fundamental_trends = read_table(FUNDAMENTAL_WORKBOOK, "Five-Year Trends", 2)
    technical = read_table(TECHNICAL_WORKBOOK, "Technical Scorecard", 4)
    technical_insights = read_table(TECHNICAL_WORKBOOK, "Company Technical Insights", 3)
    fundamentals_by_name = {name_key(row.get("Company")): row for row in fundamentals}
    fundamental_scores_by_name = {
        name_key(row.get("Company")): {
            **row,
            "Profitability Score (0-100)": row.get("Profitability Score"),
            "Growth Score (0-100)": row.get("Growth Score"),
            "Financial Strength Score (0-100)": row.get("Financial Strength Score"),
            "Valuation Score (0-100)": row.get("Valuation Score"),
            "Weighted Final Score (0-100)": row.get("Weighted Final Score"),
        }
        for row in fundamental_scores
        if row.get("Overall Rank") is not None
    }
    trends_by_name: dict[str, list[dict[str, Any]]] = {}
    for row in fundamental_trends:
        if row.get("Fiscal Year"):
            trends_by_name.setdefault(name_key(row.get("Company")), []).append(row)
    technical_by_symbol = {str(row.get("NSE Symbol", "")).strip().upper(): row for row in technical}
    technical_insights_by_name = {name_key(row.get("Company")): row for row in technical_insights}

    score_by_name = {
        str(row.get("Company", "")).strip(): row for row in scorecard
    }

    for company in companies:
        name = company.get("Standardised Company Name")
        company["integrated_scorecard"] = score_by_name.get(str(name).strip())
        fundamental = fundamentals_by_name.get(name_key(company.get("Name in Fundamental Workbook")))
        tech = technical_by_symbol.get(str(company.get("NSE Symbol (standardised)", "")).upper())
        company["fundamental_research"] = fundamental
        company["fundamental_scorecard"] = fundamental_scores_by_name.get(
            name_key(company.get("Name in Fundamental Workbook"))
        )
        company["fundamental_trends"] = trends_by_name.get(
            name_key(company.get("Name in Fundamental Workbook")), []
        )
        company["technical_research"] = tech
        company["technical_insight"] = technical_insights_by_name.get(name_key((tech or {}).get("Instrument")))

    return {
        "companies": companies,
        "scorecard": scorecard,
        "recommendations": recommendations,
    }


def get_company(company_id: str) -> dict[str, Any]:
    data = get_research_data()
    for company in data["companies"]:
        if str(company.get("ID", "")).upper() == company_id.upper():
            return company
    raise HTTPException(status_code=404, detail="Company not found")


def get_recommendation(category: str) -> dict[str, Any]:
    data = get_research_data()
    for recommendation in data["recommendations"]:
        if str(recommendation.get("Category", "")).casefold() == category.casefold():
            return recommendation
    raise HTTPException(status_code=404, detail="Investor category not found")


@lru_cache
def read_price_histories() -> dict[str, list[dict[str, Any]]]:
    # Both the research brief and the company charts use the same cleaned workbook records.
    sheets = _source_records()[TECHNICAL_WORKBOOK.name]
    _, indicator_rows = sheets["Technical Indicators"]
    _, prices = sheets["Technical Source Data"]
    fields = {
        "rsi": "RSI 14", "volume": "Volume (Used)", "sma20": "SMA 20",
        "sma50": "SMA 50", "sma200": "SMA 200", "macd": "MACD Line",
        "macd_signal": "Signal (9)", "macd_histogram": "Histogram",
    }
    indicators = {
        (str(row["NSE Symbol"]).strip().upper(), row["Date"]): row
        for row in indicator_rows if row.get("Date") is not None
    }
    histories: dict[str, list[dict[str, Any]]] = {}
    for row in prices:
        date, close = row.get("Date"), row.get("Close")
        if date is None or not isinstance(close, (int, float)):
            continue
        symbol = str(row["NSE Symbol"]).strip().upper()
        observation = indicators.get((symbol, date), {})
        histories.setdefault(symbol, []).append({
            "date": date, "close": close,
            **{key: observation.get(field) for key, field in fields.items()},
        })
    return histories


def get_price_history(company_id: str) -> dict[str, Any]:
    company = get_company(company_id)
    symbol = str(company.get("NSE Symbol (standardised)", "")).upper()
    return {
        "company_id": company_id.upper(),
        "symbol": symbol,
        "points": read_price_histories().get(symbol, []),
    }


def get_sector_research() -> dict[str, Any]:
    if not SECTOR_TEXT.is_file():
        return {"source": "Industry and sector analysis.docx", "paragraphs": [], "factors": []}
    paragraphs = [line.strip() for line in SECTOR_TEXT.read_text(encoding="utf-8").splitlines() if line.strip()]
    factors = read_table(WORKBOOK, "04_Sector_Context", 2)
    return {"source": "Industry and sector analysis.docx", "paragraphs": paragraphs, "factors": factors}
