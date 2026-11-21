from pathlib import Path
from openpyxl import load_workbook

root = Path("data/source")
path = root / "IA - Integrated Analysis.xlsx"

formulas = load_workbook(path, read_only=True, data_only=False)
values = load_workbook(path, read_only=True, data_only=True)

print("\n=== WORKSHEET AUDIT ===")
for sheet in formulas.worksheets:
    formula_count = sum(
        1
        for row in sheet.iter_rows()
        for cell in row
        if isinstance(cell.value, str) and cell.value.startswith("=")
    )
    print(
        f"{sheet.title}: {sheet.max_row} rows x "
        f"{sheet.max_column} columns | formulas: {formula_count}"
    )

for name in ["01_Company_Master", "05_Integrated_Scorecard",
             "07_Stock_Selection", "08_Final_Recommendation"]:
    if name not in formulas.sheetnames:
        continue

    print(f"\n=== {name}: PREVIEW ===")
    sheet = values[name]
    for row in sheet.iter_rows(
        min_row=1, max_row=min(sheet.max_row, 8),
        max_col=min(sheet.max_column, 10), values_only=True
    ):
        print(" | ".join(str(v) if v is not None else "" for v in row))

formulas.close()
values.close()
