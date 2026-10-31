@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8083 in your browser.
rem Give the server a moment to bind before the browser requests the page.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8083"
python serve_reference.py
pause
