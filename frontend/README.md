# Ferrum

Start the complete website from the Ferrum project folder:

```powershell
.\Start-Ferrum.cmd
```

The launcher starts the Python research API and frontend together, builds the current frontend if needed, checks that company data loads, then prints the exact browser address. Open that `http://127.0.0.1:...` address in Brave and keep the terminal open. Press Ctrl+C to stop the services started by that launcher.

You can also start from this `frontend` folder:

```powershell
npm.cmd start
```

For development with automatic reload:

```powershell
npm.cmd run dev
```

Both commands start the API as well. Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`; Python activation is unnecessary. The launcher uses the project's `.venv` directly. A production build is created automatically when missing or older than the source.

The default frontend port is 3000. If it is occupied by an unrelated or old server, the launcher selects a free port and prints it clearly. To select a port explicitly:

```powershell
npm.cmd start -- --port 3001
```

A running server is reused only when its mode matches the requested mode. Switching between development and production may therefore use a different port; follow the address printed by the launcher.

The API uses port 8000. The browser calls `/api/v1/...` on the website's own origin; Next.js forwards those requests to the research API. `FERRUM_API_ORIGIN` is the optional server-side upstream setting when managing services separately. The old `NEXT_PUBLIC_API_URL` setting is no longer used.

For the desktop presentation and browser checks, see [DESKTOP-DESIGN.md](DESKTOP-DESIGN.md).
