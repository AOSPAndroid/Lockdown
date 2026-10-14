@echo off
setlocal
cd /d "%~dp0"
title Lockdown - local game host

where node >nul 2>nul
if errorlevel 1 goto missingnode
where npm >nul 2>nul
if errorlevel 1 goto missingnode
node -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 goto oldnode

if not exist "node_modules\ws\package.json" (
  echo.
  echo   LOCKDOWN
  echo   Installing the host dependency for this PC...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto failed
)

echo.
echo   LOCKDOWN
echo   The game opens in your browser in a moment: http://localhost:3000
echo   Friends on the same Wi-Fi can join with the "Friends on your network" address below.
echo   Close this window (or press Ctrl+C) to stop the game.
echo.

rem Open the browser once the server has had a moment to start.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000/'"

node server.js
if errorlevel 1 goto failed
exit /b 0

:missingnode
echo Install Node.js 20 or newer from https://nodejs.org, then run this script again.
pause
exit /b 1

:oldnode
echo Node.js 20 or newer is required. Update Node.js, then run this script again.
pause
exit /b 1

:failed
echo The server could not start. Review the error above.
echo If it says the address is in use, Lockdown (or another program) is already running on port 3000.
pause
exit /b 1
