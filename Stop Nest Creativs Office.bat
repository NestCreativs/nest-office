@echo off
title Stop Nest Creativs Office
rem Stops only the server listening on Tool Hub's port (4600); leaves other
rem Node apps alone.
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4600" ^| findstr "LISTENING"') do (
  taskkill /f /pid %%a >nul 2>nul
  set FOUND=1
)
if "%FOUND%"=="1" (
  echo Nest Creativs Office stopped.
) else (
  echo Nest Creativs Office was not running.
)
timeout /t 2 >nul
