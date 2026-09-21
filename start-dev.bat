@echo off
title Zeus OS — Unified Dev Runner
echo ===================================================
echo   ZEUS OS — Dynamic EV Grid Orchestration Platform
echo ===================================================
echo.

echo Starting Backend Engine on port 8000...
start cmd /k "cd backend && python -m pip install -r requirements.txt && python main.py"

timeout /t 3 /nobreak >nul

echo Starting Frontend on port 5173...
start cmd /k "cd frontend && npm install && npm run dev"

echo.
echo Zeus OS Dev Environment started!
echo Open your browser at: http://localhost:5173
echo.
pause
