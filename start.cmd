@echo off
title Supermaven Proxy Server
echo.
echo ===================================
echo   Supermaven Proxy Server
echo ===================================
echo.

:: Kill existing process on port 3000
echo Checking for existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

:: Install dependencies and clean package-lock
echo Installing dependencies...
call npm install
title SuperMaven proxy
echo.
echo Removing package-lock.json...
if exist "package-lock.json" del /f "package-lock.json"
echo.

:: Start the server
echo Starting server...
echo.
node src/server.js
