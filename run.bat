@echo off
chcp 65001 > nul
title MIDAD Smart Library
cd /d "%~dp0"
echo Starting MIDAD Smart Library...
call npx vite --open
pause
