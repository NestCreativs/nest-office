@echo off
title Nest Creativs Office
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo   Node.js is not installed.
  echo   Download it from https://nodejs.org  ^(LTS version^), install it,
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo Starting Nest Creativs Office...
start "" http://localhost:4600
node server.js
pause
