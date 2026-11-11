@echo off
rem ============================================================
rem  Double-click this file to open the build panel.
rem  Kept pure ASCII on purpose: .cmd files are read in the OEM
rem  codepage, so the Chinese UI comes from node scripts\build.mjs.
rem ============================================================
chcp 65001 >nul
title Music Build Panel
cd /d "%~dp0"

if not exist "scripts\build.mjs" (
    echo.
    echo   scripts\build.mjs is missing - is this the right folder?
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo   Node.js not found. Install Node.js 20+ first:
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)

node scripts\build.mjs

rem Keep the window open when a build failed; close on a clean quit
if errorlevel 1 pause
