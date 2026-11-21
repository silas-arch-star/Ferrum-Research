from pathlib import Path

from backend.app.data_import import EXPECTED, SOURCE, inspect_workbook


def test_all_source_files_exist():
    missing = [name for name in EXPECTED if not (SOURCE / name).is_file()]
    assert not missing, f"Missing source files: {missing}"


def test_integrated_workbook_has_expected_sheets():
    path = SOURCE / "IA - Integrated Analysis.xlsx"
    sheets = inspect_workbook(path)
    names = {sheet["name"] for sheet in sheets}

    assert "01_Company_Master" in names
    assert "05_Integrated_Scorecard" in names
    assert "07_Stock_Selection" in names
