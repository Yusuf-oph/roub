@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "Roub serveur" cmd /k python serve.py 8768
  timeout /t 1 >nul
  start "" http://localhost:8768/app/
) else (
  start "" "%~dp0app\index.html"
)
