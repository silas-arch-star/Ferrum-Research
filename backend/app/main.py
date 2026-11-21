from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException

from backend.app.config import get_settings
from backend.app.data_service import (
    get_company,
    get_company_research,
    get_price_history,
    get_recommendation,
    get_research_data,
    get_sector_research,
    get_source_inventory,
)
from backend.app.schemas import (
    CompanyListResponse,
    CompanyResponse,
    PriceHistoryResponse,
    RecommendationListResponse,
    SectorResearchResponse,
    ProviderStatus, ResearchMode, ResearchQuestion, ResearchRun, ResearchSnapshot, EvidenceResponse, ThesisMonitor,
)
from backend.app.intelligence import (latest_research, latest_run, provider_status, research_history,
                                      search_evidence, start_run, thesis_monitor, update_research)

settings = get_settings()

app = FastAPI(
    title=f"{settings.app_name} API",
    description="Research and investment analysis API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "application": settings.app_name}


@app.get("/api/v1/companies", tags=["Research"], response_model=CompanyListResponse)
def list_companies():
    companies = get_research_data()["companies"]
    return {"count": len(companies), "companies": companies}


@app.get("/api/v1/companies/{company_id}", tags=["Research"], response_model=CompanyResponse)
def company_detail(company_id: str):
    return get_company(company_id)


@app.get("/api/v1/companies/{company_id}/research", tags=["Research"])
def company_research(company_id: str):
    return get_company_research(company_id)


@app.get("/api/v1/recommendations", tags=["Research"], response_model=RecommendationListResponse)
def list_recommendations():
    recommendations = get_research_data()["recommendations"]
    return {"count": len(recommendations), "recommendations": recommendations}


@app.get("/api/v1/companies/{company_id}/prices", tags=["Research"], response_model=PriceHistoryResponse)
def company_price_history(company_id: str):
    return get_price_history(company_id)


@app.get("/api/v1/sector", tags=["Research"], response_model=SectorResearchResponse)
def sector_research():
    return get_sector_research()


@app.get("/api/v1/sources", tags=["Research"])
def source_inventory():
    return get_source_inventory()


@app.get("/api/v1/intelligence/status", tags=["Ferrum Intelligence"], response_model=ProviderStatus)
def intelligence_status():
    return provider_status()


@app.post("/api/v1/intelligence/companies/{company_id}/evidence", tags=["Ferrum Intelligence"], response_model=EvidenceResponse)
async def company_evidence(company_id: str, request: ResearchQuestion):
    return await search_evidence(company_id, refresh=request.refresh, question=request.question)


@app.post("/api/v1/intelligence/companies/{company_id}/research-updates", tags=["Ferrum Intelligence"], response_model=ResearchSnapshot)
async def company_research_update(company_id: str, request: ResearchQuestion):
    return await update_research(company_id, request)


@app.post("/api/v1/intelligence/companies/{company_id}/analysis-run", status_code=202, response_model=ResearchRun)
async def company_start_analysis(company_id: str, request: ResearchQuestion):
    return await start_run(company_id, request)


@app.get("/api/v1/intelligence/companies/{company_id}/analysis-run", response_model=ResearchRun | None)
def company_analysis_state(company_id: str):
    return latest_run(company_id)


@app.get("/api/v1/intelligence/companies/{company_id}/latest", tags=["Ferrum Intelligence"], response_model=ResearchSnapshot | None)
def company_latest_research(company_id: str, mode: ResearchMode | None = None):
    return latest_research(company_id, mode)


@app.get("/api/v1/intelligence/companies/{company_id}/history", tags=["Ferrum Intelligence"])
def company_research_history(company_id: str):
    return {"snapshots": research_history(company_id)}


@app.get("/api/v1/intelligence/companies/{company_id}/monitor", tags=["Ferrum Intelligence"], response_model=ThesisMonitor)
def company_thesis_monitor(company_id: str, mode: ResearchMode | None = None):
    return thesis_monitor(company_id, mode)
