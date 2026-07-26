@echo off
"C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server' && PORT=8080 DATABASE_URL='postgresql://postgres@localhost:5432/portfolio_dev' pnpm run start"
pause
