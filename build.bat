@echo off
cd /d "%~dp0"
if not exist tailwindcss.exe (
  echo Downloading Tailwind CLI, please wait...
  curl -L -o tailwindcss.exe https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe
)
if not exist css mkdir css
tailwindcss.exe -c tailwind.config.js -i input.css -o css/styles.css --minify
echo.
echo Done! Now upload index.html, css and js to GitHub.
pause
