@echo off
setlocal
cd /d "%~dp0src"

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8000
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8000
  goto :eof
)

echo Python was not found on PATH.
echo Install Python or start a local web server in the src folder manually.
