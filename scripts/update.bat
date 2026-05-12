@echo off
chcp 65001 > nul
echo [TV+ Galaxy] Updating Apple TV+ data from TMDB...
cd /d "%~dp0.."
node scripts\fetch-data.js
if %errorlevel% neq 0 (
  echo Update failed. Check config.json and your TMDB API key.
  pause
  exit /b 1
)
echo.
echo Update complete! Refresh your browser to see the latest data.
pause
