@echo off
cd /d G:\tp\ai\portofolio-dashbaord\artifacts\api-server
set PORT=8080
set DATABASE_URL=postgresql://postgres@localhost:5432/portfolio_dev
pnpm run start
