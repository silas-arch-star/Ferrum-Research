"""Read-only, bounded access to the saved values in Ferrum's workbook library."""

from functools import lru_cache
import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from backend.app.data_service import _company_names, _matches_company, _source_records
from backend.app.schemas import WorkbookRead


class ReadRequest(BaseModel):
    sheet_id: str
    scope: Literal["company", "sheet"] = "company"
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=4, ge=1, le=8)
    fields: list[str] = Field(default_factory=list, max_length=18)


class ResearchPlan(BaseModel):
    chart_ids: list[str] | None = Field(default=None, max_length=4)
    reads: list[ReadRequest] = Field(default_factory=list, max_length=6)
    topics: list[Literal["filings", "earnings", "capacity", "markets", "regulation", "balance_sheet"]] = Field(default_factory=list, max_length=2)


@lru_cache(maxsize=1)
def library():
    library = {}
    for book_index, (workbook, sheets) in enumerate(_source_records().items(), 1):
        for sheet_index, (sheet, (fields, rows)) in enumerate(sheets.items(), 1):
            library[f"B{book_index}S{sheet_index:02}"] = (workbook, sheet, [f for f in fields if f], rows)
    return library


def _matches(company: dict, rows: list[dict]) -> list[dict]:
    names = _company_names(company)
    symbols = {str(company.get(key) or "").strip().upper() for key in (
        "NSE Symbol (standardised)", "NSE Symbol in Fundamental Workbook", "NSE Symbol in Technical Workbook",
    )} - {""}
    return [row for row in rows if _matches_company(row, names, symbols)]


def company_sheet_rows(company: dict, workbook: str, sheet: str) -> list[dict]:
    _, rows = _source_records().get(workbook, {}).get(sheet, ([], []))
    return _matches(company, rows)


def catalog(company: dict) -> list[dict]:
    return [
        {"sheet_id": key, "workbook": book, "sheet": sheet, "fields": fields, "saved_rows": len(rows),
         "company_rows": len(_matches(company, rows))}
        for key, (book, sheet, fields, rows) in library().items()
    ]


def read_workbooks(company: dict, inventory: list[dict], requests: list[ReadRequest]) -> tuple[list[dict], list[WorkbookRead]]:
    """Every parsed sheet is addressable. Return the requested pages plus a broad company baseline."""
    selected = list(requests) + [
        ReadRequest(sheet_id=item["sheet_id"], limit=2)
        for item in inventory if item["company_rows"]
    ]
    context: list[dict] = []
    trace: list[WorkbookRead] = []
    visited: set[tuple] = set()
    included_chars = 0
    for request in selected:
        fingerprint = (request.sheet_id, request.scope, request.offset)
        if fingerprint in visited or request.sheet_id not in library():
            continue
        visited.add(fingerprint)
        workbook, sheet, fields, all_rows = library()[request.sheet_id]
        rows = _matches(company, all_rows) if request.scope == "company" else all_rows
        fields = [field for field in fields if field in request.fields] if request.fields else fields
        if not rows or not fields:
            continue
        # Date-labelled tables return their newest records first. Other sheets preserve source order.
        date_keys = ("Date", "Latest Date", "Holding Date", "Fiscal Year")
        date_field = next((field for field in date_keys if any(row.get(field) for row in rows)), None)
        if date_field:
            rows = sorted(rows, key=lambda row: str(row.get(date_field) or ""), reverse=True)
        page = []
        for row in rows[request.offset:request.offset + request.limit]:
            values = {field: row.get(field) for field in fields if row.get(field) is not None}
            chars = len(json.dumps(values, ensure_ascii=False, default=str))
            if chars > 14_000 or included_chars + chars > 115_000:
                break
            included_chars += chars
            page.append(values)
        if not page:
            continue
        reference = f"internal:{request.sheet_id}/{request.scope}/{request.offset + 1}-{request.offset + len(page)}"
        trace.append(WorkbookRead(reference=reference, workbook=workbook, sheet=sheet, scope=request.scope, records=len(page), available=len(rows)))
        context.append({"reference": reference, "workbook": workbook, "sheet": sheet, "rows": page})
    return context, trace


def default_reads(inventory: list[dict], question: str) -> list[ReadRequest]:
    terms = set(re.findall(r"[a-z]{4,}", question.casefold()))
    shared = [item for item in inventory if item["saved_rows"] and not item["company_rows"]]
    shared.sort(key=lambda item: len(terms.intersection(re.findall(r"[a-z]{4,}", item["sheet"].casefold()))), reverse=True)
    return [ReadRequest(sheet_id=item["sheet_id"], scope="sheet", limit=3) for item in shared[:3]]
