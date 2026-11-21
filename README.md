# Ferrum

Ferrum is an independent research project on India's metals and mining sector. The material is for informational and research purposes only. Investment advice and recommendations to buy, sell, or hold securities are outside the project's scope.

## Start the website

From this folder, run:

```powershell
.\Start-Ferrum.cmd
```

Double-click `Start-Ferrum.cmd` to open the website in Brave (or your default browser if Brave is unavailable). It waits until the website and research data are ready and displays the address. Keep the first launcher window open while using Ferrum. Double-clicking again opens the running site, and you can dismiss that second window with Enter.

- The normal browser address is `http://127.0.0.1:3000`. If an older build still occupies that port, the launcher serves and opens the current build on another port.
- Port 8000 is the research API, not the website.
- `0.0.0.0` is a listening address, not the browser URL.
- Ctrl+C stops the services started by the launcher. An already-running Ferrum service that was reused is left running.
- A running server is reused when it matches the mode and, for production, the current frontend source.

### Open Ferrum on a phone

Connect the phone and computer to the same private Wi-Fi. Double-click `Start-Ferrum-Mobile.cmd` on the computer and open the address printed in that window on the phone. Keep the launcher open. If Windows asks for network access for Node.js, allow it on your private network. The phone uses the same research API through the website.

Swipe through the mineral artifact or tap **Skip intro** to enter. Use the header menu to switch research modules. On phone-sized screens, browse sortable company cards, pick a measure to compare selected companies, and open workbook sheets one row at a time. Each of the four market-structure charts has its own zoom slider.

The same frontend serves phones, tablets, and desktops. For a public deployment from GitHub, run both the Next.js frontend and the Python API. Set `FERRUM_API_ORIGIN` when building the frontend if the API runs on a separate host, and provision the research workbooks on the API host. The local `data/` directory is excluded from Git.

To use a specific frontend port:

```powershell
.\Start-Ferrum.cmd --port 3001
```

To develop with live reload:

```powershell
.\Start-Ferrum.cmd --dev
```

`npm.cmd start` and `npm.cmd run dev` also work from either this folder or `frontend`. These commands use the same complete launcher; no second API terminal or PowerShell environment activation is required.

## First-time setup

The project requires Node.js and a Python virtual environment. If dependencies are missing:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd --prefix frontend install
```

Put optional research-provider keys in `backend/.env`, using `backend/.env.example` as a template. Use `FERRUM_DEBUG` for Ferrum's debug setting; unrelated system `DEBUG` values are ignored.

The frontend's browser requests stay on its own origin. Next.js proxies `/api/v1/...` to the local research API, avoiding a separate browser connection to port 8000.

## Desktop experience

Fresh visits begin with the original Ferrum Research mineral artifact. Scroll, press Enter or use Skip to enter the research site. The homepage's **Replay the artifact** control opens it again.

Desktop combines native scrolling with animated page arrivals, category changes, and chart updates. Keyboard controls and reduced-motion preferences are supported. Implementation and validation details are in [frontend/DESKTOP-DESIGN.md](frontend/DESKTOP-DESIGN.md).

## Intelligence workbench

Choose a company under **Intelligence**, then choose **Automated review**, **Focused question**, **Workbook only**, or **Web only**. Automated review reads relevant pages from the workbook library and looks for public filings and recent developments. The saved report lists its workbook reads and search queries under **Evidence used**. Analysis continues while you browse other pages during the same server session.

The workbook catalog covers all 33 sheets across the three source workbooks. The backend selects the rows for each review and passes them to Gemini Flash-Lite for structured synthesis. SerpApi receives public-company search terms. Web only uses public search excerpts. Workbook only skips search. If Gemini is unavailable, Ferrum saves a labeled local analysis with period comparisons and cited coverage of public developments where available. A web-only search with no results shows the reason and leaves the previous brief intact.

Provider references: [Gemini structured output](https://aistudio.google.com/docs/structured-output) and [SerpApi Google Search](https://serpapi.com/search-api).
