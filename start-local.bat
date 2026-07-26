@echo off
start "Backend" "G:\tp\ai\portofolio-dashbaord\start-backend.bat"
timeout /t 3 /nobreak >nul
start "Frontend" "G:\tp\ai\portofolio-dashbaord\start-frontend.bat"
echo Both servers are starting. Give them a few seconds, then open http://localhost:3000/
