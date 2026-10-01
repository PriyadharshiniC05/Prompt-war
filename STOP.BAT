@echo off
setlocal

echo ========================================
echo         AI PROMPT WAR - STOPPING
echo ========================================

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Stopping process %%P on port 3000...
  taskkill /PID %%P /F >nul 2>&1
)

echo Server stopped.
endlocal
pause
