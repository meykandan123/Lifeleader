@echo off
echo ===================================================
echo   Starting LifeLedger AI Local Server
echo   Project: lifeleader-c60e8
echo ===================================================
echo.
echo Opening http://localhost:8000 in your default browser...
start http://localhost:8000
echo.
echo Server running. Press Ctrl+C in this window to stop.
echo.
python -m http.server 8000
pause
