@echo off
echo ========================================================
echo Reiniciando Dashboard Agents (Backend y Frontend)
echo ========================================================
echo.

echo Cerrando instancias anteriores (si existen)...
taskkill /FI "WINDOWTITLE eq Backend - Dashboard Agents*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend - Dashboard Agents*" /F /T >nul 2>&1

:: Asegurar que los puertos esten libres (Backend: 3001, Frontend: 5174)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5174" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

timeout /t 2 /nobreak >nul
echo.
echo Iniciando Backend en una nueva ventana...
start "Backend - Dashboard Agents" cmd /k "cd backend && npm start"

echo Iniciando Frontend en una nueva ventana...
start "Frontend - Dashboard Agents" cmd /k "cd frontend && npm run dev"

echo.
echo Los servidores se estan ejecutando en ventanas separadas.
echo Puedes presionar cualquier tecla para cerrar esta ventana.
pause > nul

