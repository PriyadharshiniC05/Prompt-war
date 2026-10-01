@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo        AI PROMPT WAR - STARTING
echo ========================================

if not exist package.json (
  echo ERROR: package.json not found.
  echo Put START.BAT in the same folder as package.json.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js 18+ and reopen PowerShell.
  pause
  exit /b 1
)

if not exist node_modules\express (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

if not exist .env (
  if exist .env.example (
    copy /Y .env.example .env >nul
    echo Created .env from .env.example.
    echo IMPORTANT: Edit .env and set GEMINI_API_KEY before generating.
  )
)

echo.
echo Starting server at http://localhost:3000
call npm.cmd start

endlocal
