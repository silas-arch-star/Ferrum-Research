from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.data_service import get_company_research, get_research_data

client = TestClient(app)


def test_companies_endpoint_returns_twenty_companies():
    response = client.get("/api/v1/companies")
    assert response.status_code == 200
    assert response.json()["count"] == 20


def test_company_detail_uses_real_workbook():
    response = client.get("/api/v1/companies/C01")
    assert response.status_code == 200
    assert response.json()["Standardised Company Name"] == "JSW Steel Ltd."


def test_recommendations_returns_seven_categories():
    response = client.get("/api/v1/recommendations")
    assert response.status_code == 200
    assert response.json()["count"] == 7


def test_unknown_company_returns_404():
    assert client.get("/api/v1/companies/C99").status_code == 404


def test_company_research_exposes_long_form_source_data():
    response = client.get("/api/v1/companies/C01/research")
    assert response.status_code == 200
    sections = {section["sheet"]: section for section in response.json()["sections"]}
    assert sections["Financial Statement Dataset"]["rows"]
    assert sections["Technical Indicators"]["rows"]
    assert sections["Company Ownership Information"]["rows"]


def test_scores_keep_their_source_defined_zero_to_one_hundred_scale():
    companies = client.get("/api/v1/companies").json()["companies"]
    for company in companies:
        for row, field in (
            (company["fundamental_research"], "Final Score"),
            (company["technical_research"], "Total Score (100)"),
            (company["integrated_scorecard"], "Integrated Score = wF x Fundamental + wT x Normalised Technical"),
        ):
            value = row.get(field) if row else None
            if value is not None:
                assert isinstance(value, (int, float))
                assert 0 <= value <= 100


def test_fundamental_components_use_authoritative_company_ranking_values():
    companies = client.get("/api/v1/companies").json()["companies"]
    for company in companies:
        components = company["fundamental_scorecard"]
        assert components["Overall Rank"] is not None
        for field in (
            "Profitability Score (0-100)",
            "Growth Score (0-100)",
            "Financial Strength Score (0-100)",
            "Valuation Score (0-100)",
        ):
            assert 0 <= components[field] <= 100
        assert len(company["fundamental_trends"]) >= 2
        assert company["fundamental_trends"][-1]["Fiscal Year"] == "FY 2025-26"
    nalco = next(company for company in companies if company["ID"] == "C12")
    assert nalco["fundamental_scorecard"]["Overall Rank"] == 1
    assert abs(nalco["fundamental_scorecard"]["Weighted Final Score"] - 75.5204166667) < 0.001


def test_price_history_includes_aligned_supported_indicators():
    response = client.get("/api/v1/companies/C01/prices")
    assert response.status_code == 200
    points = response.json()["points"]
    assert points
    latest = points[-1]
    assert latest["sma20"] is not None
    assert "macd" in latest and "macd_signal" in latest and "macd_histogram" in latest


def test_integrated_leader_and_final_recommendation_remain_distinct():
    companies = client.get("/api/v1/companies").json()["companies"]
    leader = next(company for company in companies if company["Standardised Company Name"] == "Shyam Metalics & Energy Ltd.")
    assert leader["integrated_scorecard"]["Integrated Rank"] == 1
    recommendations = client.get("/api/v1/recommendations").json()["recommendations"]
    overall = next(item for item in recommendations if item["Category"].endswith("Overall Best Investment"))
    assert overall["Selected Company (model, eligible only)"] == "National Aluminium Co. Ltd."


def test_source_inventory_is_based_on_actual_workbook_sheets():
    response = client.get("/api/v1/sources")
    assert response.status_code == 200
    sheets = {(row["source"], row["sheet"]) for row in response.json()["sources"]}
    assert ("IA - Fundamental Analysis.xlsx", "Financial Statement Dataset") in sheets
    assert ("IA - Technical Analysis.xlsx", "Technical Indicators") in sheets
    assert ("IA - Integrated Analysis.xlsx", "05_Integrated_Scorecard") in sheets


def test_company_name_and_symbol_mapping_covers_all_twenty_ids():
    companies = get_research_data()["companies"]
    assert len({company["ID"] for company in companies}) == 20
    for company in companies:
        research = get_company_research(company["ID"])
        source_sheets = {(section["source"], section["sheet"]) for section in research["sections"]}
        assert research["company_name"] == company["Standardised Company Name"]
        assert ("IA - Fundamental Analysis.xlsx", "Financial Statement Dataset") in source_sheets
        assert ("IA - Technical Analysis.xlsx", "Technical Source Data") in source_sheets
        assert ("IA - Integrated Analysis.xlsx", "05_Integrated_Scorecard") in source_sheets
