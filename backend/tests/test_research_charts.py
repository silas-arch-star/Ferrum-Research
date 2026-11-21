import pytest

from backend.app.data_service import get_company, get_price_history
from backend.app.research_charts import OVERVIEW, build_charts


@pytest.mark.parametrize("company_id", [f"C{i:02}" for i in range(1, 21)])
def test_company_exhibits_match_question_and_workbook(company_id):
    company = get_company(company_id)
    debt = build_charts(company, "How exposed is the company to debt refinancing?")
    overview = build_charts(company, "Who chairs the board?")
    daily = build_charts(company, "How has trading momentum changed?", ["price", "rsi", "macd", "volume"])
    for charts in (debt, overview, daily):
        assert len({chart.id for chart in charts}) == 4
        for chart in charts:
            assert chart.period and chart.source and len(chart.rows) >= 2
            assert all(any(isinstance(row.get(series.key), (int, float)) for row in chart.rows) for series in chart.series)
    assert debt[0].id in {"maturity", "interest", "debt"}
    assert [item.id for item in overview] == list(OVERVIEW)
    assert all(chart.context for chart in overview)
    price = daily[0]
    assert price.id == "price" and not price.context
    assert price.rows[-1]["v0"] == max(get_price_history(company_id)["points"], key=lambda row: row["date"])["close"]


def test_chart_planner_cannot_supply_values_or_duplicate_exhibits():
    company = get_company("C01")
    charts = build_charts(company, "Explain executive appointments", [])
    assert all(chart.context for chart in charts)
    choices = ["margins", "margins", "unsupported", "cash_quality"]
    charts = build_charts(company, "How do margins translate to cash?", choices)
    assert [chart.id for chart in charts[:2]] == ["margins", "cash_quality"]
    assert [chart.context for chart in charts] == [False, False, True, True]
    assert charts[0].rows[-1]["v0"] == pytest.approx(100 * company["fundamental_trends"][-1]["Operating Margin (reported)"])
