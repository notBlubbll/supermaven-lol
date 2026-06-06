@echo off
title Supermaven Proxy Server
echo.
echo ===================================
echo   Supermaven Proxy Server
echo ===================================
echo.

:: Install dependencies and clean package-lock
echo Installing dependencies...
call npm install
echo.
echo Removing package-lock.json...
if exist "package-lock.json" del /f "package-lock.json"
echo.

:: Start the server
echo Starting server...
echo.
node src/server.js
pause
