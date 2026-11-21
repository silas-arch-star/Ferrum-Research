@echo off
call "%~dp0Start-Ferrum.cmd" --mobile %*
exit /b %errorlevel%
