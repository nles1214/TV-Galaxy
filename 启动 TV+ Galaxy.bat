@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo TV+ Galaxy starting...
echo Close both windows to stop.
echo.
start "TVGalaxy-Server" node scripts\server.js
ping -n 3 127.0.0.1 > nul
start http://localhost:8080
