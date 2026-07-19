@echo off
setlocal
cd /d "%~dp0"
echo Limpiando instalacion anterior...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
call npm cache verify
call npm config set registry https://registry.npmjs.org/
echo Instalando dependencias...
call npm install
if errorlevel 1 (
  echo.
  echo La instalacion fallo. Verifique internet, proxy o antivirus.
  pause
  exit /b 1
)
echo.
echo Iniciando aplicacion...
call npm run dev
pause
