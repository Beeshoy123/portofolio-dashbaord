@echo off
"C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server' && unset DATABASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY PORTFOLIO_OWNER_USER_ID USE_POOLER && PORT=8080 pnpm run start"
pause

