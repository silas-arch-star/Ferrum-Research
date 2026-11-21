# Ferrum Backend

## Install backend dependencies

Run these commands from the Ferrum project root. Calling the virtual environment's Python directly avoids PowerShell activation-policy errors.

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## Run tests
```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```

## Start the development API (from the project root)
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

This starts the API only; the frontend must also be running to open the website. Keep the terminal open while using the API. The API's host address is not the website address.

## Debug configuration

Set `FERRUM_DEBUG=true` or `FERRUM_DEBUG=false` in `backend/.env` to control Ferrum's debug setting. An unrelated shell variable such as `DEBUG=release` is ignored and no longer prevents startup. Existing valid `DEBUG=true`/`DEBUG=false` entries in the project's `backend/.env` remain supported; `FERRUM_DEBUG` takes precedence. Provider configuration variable names are unchanged.

## Local endpoints
- Health: http://127.0.0.1:8000/health
- API documentation: http://127.0.0.1:8000/docs

## Ferrum Intelligence

Add `GEMINI_API_KEY`, `SERPAPI_API_KEY`, and (optionally) `GEMINI_MODEL` to the ignored `backend/.env` file. The safe template is `backend/.env.example`. The selected Gemini model defaults to `gemini-3.5-flash-lite`; provider availability is visible at `/api/v1/intelligence/status` without revealing keys.

Research updates run only after an explicit user action. SerpApi results are cached for six hours by default, limited to eight records, and displayed as unverified search snippets. Gemini produces a Pydantic-validated brief whose citations are checked against the current retrieved source IDs and mapped workbook references. Dated reports are stored locally in the ignored `data/processed/ferrum_intelligence.sqlite3` file for source-coverage comparisons.

Endpoints: `POST /api/v1/intelligence/companies/{id}/evidence`, `POST /api/v1/intelligence/companies/{id}/research-updates`, `GET /api/v1/intelligence/companies/{id}/latest`, `GET /api/v1/intelligence/companies/{id}/history`, and `GET /api/v1/intelligence/companies/{id}/monitor`.
