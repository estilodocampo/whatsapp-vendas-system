@echo off
set "NODE=C:\Program Files\nodejs\node.exe"
set "NPM=C:\Program Files\nodejs\npm.cmd"
cd /d "%~dp0"
if not exist "node_modules" (
  echo Instalando dependencias...
  call "%NPM%" install
)
echo Iniciando sistema...
"%NODE%" server.js
pause
