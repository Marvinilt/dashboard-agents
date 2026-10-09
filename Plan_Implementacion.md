# Plan de Implementación Detallado: Gamified Dashboard

Este documento desglosa las tareas necesarias para construir el sistema paso a paso, dividido en fases manejables.

## Fase 1: Setup y Pruebas Base de Telemetría (Semana 1)
**Objetivo:** Tener el entorno inicializado y un script de Node capaz de parsear los logs crudos.

- [ ] **Tarea 1.1:** Inicializar repositorio principal (Git).
- [ ] **Tarea 1.2:** Crear carpeta `backend` e inicializar proyecto Node.js (`npm init`).
- [ ] **Tarea 1.3:** Instalar dependencias en backend (`express`, `socket.io`, `chokidar`, `cors`).
- [ ] **Tarea 1.4:** Crear un script básico (`test_reader.js`) que lea el archivo `.jsonl` de un agente usando streams de Node, logrando imprimir en consola solo los eventos relevantes (`type`, `status`, `tool_calls`).

## Fase 2: El Simulador "Playback Engine" (Semana 1-2)
**Objetivo:** Construir el servidor WebSockets y simular una sesión en tiempo real a partir de logs guardados.

- [ ] **Tarea 2.1:** Copiar un par de carpetas de la ruta `Conversaciones ejemplo` hacia una carpeta local `mock_data/` en el backend para hacer pruebas seguras.
- [ ] **Tarea 2.2:** Crear `server.js` para inicializar el servidor Express y el servidor Socket.IO en el puerto 3001.
- [ ] **Tarea 2.3:** Desarrollar `simulator.js`. Este script debe:
  - Leer línea por línea el `transcript.jsonl` mockeado.
  - Calcular la diferencia de tiempo (`created_at`) entre la línea actual y la anterior.
  - Usar `setTimeout` para emitir el evento al WebSocket respetando el retardo real (simulando "en vivo").
- [ ] **Tarea 2.4:** Implementar el "Gestor de Sesiones" en el backend: Una ruta API HTTP (`GET /api/sessions`) que lea la carpeta `mock_data` y devuelva la lista de proyectos disponibles.

## Fase 3: Setup Gráfico y UI React (Semana 2-3)
**Objetivo:** Tener React y Phaser montados, listos para dibujar.

- [ ] **Tarea 3.1:** Crear carpeta `frontend` e inicializar React con Vite (`npm create vite@latest frontend -- --template react`).
- [ ] **Tarea 3.2:** Instalar dependencias frontend (`socket.io-client`, `phaser`, `tailwindcss`).
- [ ] **Tarea 3.3:** Configurar TailwindCSS.
- [ ] **Tarea 3.4:** Crear componente `SessionSelector.jsx` (Menú desplegable) que consuma `GET /api/sessions` y muestre los proyectos.
- [ ] **Tarea 3.5:** Crear componente `PhaserGame.jsx` que instancie el motor Phaser dentro de un `div` de React.

## Fase 4: La Oficina Virtual y Avatares (Phaser Core) (Semana 3-4)
**Objetivo:** Renderizar el entorno isométrico y recibir eventos de Socket.IO.

- [ ] **Tarea 4.1:** Dibujar (o conseguir assets de internet) el *tile* del piso y el sprite del escritorio en formato Isométrico (Ej. Kenney.nl IT assets).
- [ ] **Tarea 4.2:** Programar la Escena Principal de Phaser para renderizar el grid de piso y colocar 5-10 escritorios con estado `isOccupied = false`.
- [ ] **Tarea 4.3:** Conectar Socket.IO en React y pasar los eventos recibidos a la Escena de Phaser mediante un bus de eventos (ej. evento `SPAWN_AGENT`).
- [ ] **Tarea 4.4:** Programar la clase `Avatar`:
  - Recibe el `agentId`.
  - Aparece en la coordenada (0,0) (Puerta).
  - Busca el escritorio libre más cercano y camina hacia él.
- [ ] **Tarea 4.5:** Mapear animaciones: Cambiar el *frame* del sprite cuando el socket emita evento de `WORKING` (tecleando) o `WAITING_INPUT` (dibujar globo de 💬 encima).

## Fase 5: Interactividad UI y Ciclo de Vida (Semana 4-5)
**Objetivo:** Implementar clics, ventanas de detalle y reglas de memoria (Sala de descanso).

- [ ] **Tarea 5.1:** Hacer los sprites clickeables en Phaser. Al hacer clic, emitir evento hacia React con el `agentId`.
- [ ] **Tarea 5.2:** Construir `AgentSidebar.jsx` en React. Este panel lateral debe suscribirse a los mensajes en crudo del socket para ese agente específico y mostrar un *feed* de texto tipo terminal.
- [ ] **Tarea 5.3:** Lógica de Sala de Descanso (Backend o Frontend FSM): Programar temporizador de 3 minutos tras último evento. Si se cumple, mover avatar a coordenadas de "Sala de descanso".
- [ ] **Tarea 5.4:** Lógica de Despawn Definitivo: Temporizador de 10 minutos. Si se cumple, eliminar instancia de Avatar y emitir `destroy()` en Phaser.
- [ ] **Tarea 5.5:** Limpieza de Oficina (Switch Session): Cuando React emite cambio de sesión en el selector, iterar sobre todos los avatares vivos, destruirlos, y pedir al backend que inicie el simulador de la nueva sesión elegida.

## Fase 6: Transición a Modo Watcher Real (Fase Final)
**Objetivo:** Apagar el simulador y conectar a Antigravity real.

- [ ] **Tarea 6.1:** Crear `watcher.js` usando `chokidar`. Vigilar los archivos `transcript.jsonl` reales en `/.gemini/antigravity/brain/`.
- [ ] **Tarea 6.2:** Emitir eventos limpios directamente al socket conforme el framework va escribiendo al disco, apagando el modo "Playback".

