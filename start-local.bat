@echo off
setlocal
cd /d "%~dp0"
echo.
echo  GROVEE NEWS — local dev server
echo  http://127.0.0.1:5190/
echo.
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
call npm run dev -- --open
endlocal
