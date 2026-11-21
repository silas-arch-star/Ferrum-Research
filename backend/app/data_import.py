import hashlib
import json
from datetime import date, datetime
from pathlib import Path

from docx import Document
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "source"
OUTPUT = ROOT / "data" / "processed"

EXPECTED = [
    "IA - Integrated Analysis.xlsx",
    "IA - Fundamental Analysis.xlsx",
    "IA - Technical Analysis.xlsx",
    "Industry and sector analysis.docx",
]


def json_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_workbook(path):
    workbook = load_workbook(path, read_only=True, data_only=False)
    sheets = []

    for sheet in workbook.worksheets:
        preview = []
        for row in sheet.iter_rows(min_row=1, max_row=min(4, sheet.max_row),
                                   values_only=True):
            preview.append([json_value(v) for v in row[:12]])

        sheets.append({
            "name": sheet.title,
            "rows": sheet.max_row,
            "columns": sheet.max_column,
            "preview": preview,
        })

    workbook.close()
    return sheets


def export_technical_prices(path, destination):
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook["Technical Source Data"]
    rows = sheet.iter_rows(values_only=True)
    headers = next(rows)
    count = 0

    with destination.open("w", encoding="utf-8") as output:
        output.write("[\n")
        first = True
        for row in rows:
            if not any(value is not None for value in row):
                continue
            record = {
                str(headers[i]): json_value(value)
                for i, value in enumerate(row)
                if i < len(headers)
            }
            if not first:
                output.write(",\n")
            output.write(json.dumps(record, ensure_ascii=False, default=str))
            first = False
            count += 1
        output.write("\n]\n")

    workbook.close()
    return count


def run_import():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    missing = [name for name in EXPECTED if not (SOURCE / name).is_file()]
    if missing:
        raise FileNotFoundError(
            "Missing source files in data/source: " + ", ".join(missing)
        )

    manifest = {"files": [], "warnings": []}

    for name in EXPECTED:
        path = SOURCE / name
        entry = {
            "filename": name,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }

        if path.suffix.lower() == ".xlsx":
            entry["worksheets"] = inspect_workbook(path)
        else:
            document = Document(path)
            entry["paragraph_count"] = len(document.paragraphs)
            entry["nonempty_paragraph_count"] = sum(
                bool(p.text.strip()) for p in document.paragraphs
            )

            text_path = OUTPUT / "sector_research.txt"
            text_path.write_text(
                "\n".join(
                    p.text.strip() for p in document.paragraphs
                    if p.text.strip()
                ),
                encoding="utf-8",
            )
            entry["extracted_text"] = text_path.name

        manifest["files"].append(entry)

    technical_path = SOURCE / "IA - Technical Analysis.xlsx"
    price_count = export_technical_prices(
        technical_path, OUTPUT / "technical_prices.json"
    )
    manifest["technical_price_rows_exported"] = price_count
    manifest["note"] = (
        "Formula cells are inventoried, not recalculated. "
        "The raw technical source sheet is exported using saved cell values. "
        "Validate cached formula results before using them as authoritative."
    )

    (OUTPUT / "workbook_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    print("Import completed.")
    print(f"Source files verified: {len(manifest['files'])}")
    for file in manifest["files"]:
        if "worksheets" in file:
            print(f"{file['filename']}: {len(file['worksheets'])} worksheets")
    print(f"Technical price rows exported: {price_count}")
    print(f"Output directory: {OUTPUT}")


if __name__ == "__main__":
    run_import()
