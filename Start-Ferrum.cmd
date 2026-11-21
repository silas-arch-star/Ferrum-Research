@echo off
setlocal
set "FERRUM_NODE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 set "FERRUM_NODE=%ProgramFiles%\nodejs\node.exe"
if not "%FERRUM_NODE%"=="node.exe" if not exist "%FERRUM_NODE%" (
  echo Node.js was not found. Install Node.js, then run Start-Ferrum.cmd again.
  pause
  exit /b 1
)
if "%~1"=="" (
  "%FERRUM_NODE%" "%~dp0scripts\start-ferrum.mjs" --open
) else (
  "%FERRUM_NODE%" "%~dp0scripts\start-ferrum.mjs" %*
)
if errorlevel 1 (
  echo.
  echo Ferrum could not start. The reason is printed above.
  pause
  exit /b 1
)
exit /b 0
