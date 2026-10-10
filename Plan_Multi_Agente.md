# Plan de Implementación: Escaneo Recursivo y Multi-Agente (Core)

Este documento detalla la arquitectura y los pasos para implementar el soporte multi-carpeta en el backend, lo cual permitirá escuchar y reproducir los transcripts de todos los subagentes involucrados en una sesión de Antigravity.

## 1. Análisis del Comportamiento Actual
Actualmente, el backend (`watcher.js` y `simulator.js`) únicamente lee el archivo `transcript.jsonl` del orquestador principal (Team Leader). 
Cuando el Team Leader crea subagentes, la creación queda registrada en dos pasos:
1. Un evento tipo `PLANNER_RESPONSE` donde se utiliza la herramienta `invoke_subagent` indicando el `TypeName` y el `Role`.
2. Un evento tipo `GENERIC` que contiene la cadena `"Created the following subagents:"` seguido de un bloque JSON con el `conversationId` (UUID) y el `logAbsoluteUri` de los nuevos subagentes.

Dado que Antigravity crea una nueva carpeta aislada dentro de `brain/` para cada subagente, el dashboard no está leyendo las acciones internas (Tool Calls, Thinking, etc.) que realizan los subagentes porque ignora estas rutas.

## 2. Solución Arquitectónica

Se adaptarán los módulos `parser.js`, `watcher.js` y `simulator.js` para detectar dinámicamente la creación de subagentes y "engancharse" (attach) a sus respectivos archivos de logs.

### A. Modificaciones en `parser.js`
- **Extraer UUID y URI:** Se modificará `parseTranscriptLine` para que cuando detecte un evento `GENERIC` que contenga `"Created the following subagents:"`, extraiga mediante regex o parsing el JSON incluido.
- **Nuevo Evento:** Se emitirá un evento interno `SUBAGENT_CREATED` que contenga el `conversationId` y la ruta real en disco del nuevo transcript.

### B. Modificaciones en `watcher.js` (Modo Live)
- **Múltiples Watchers:** En lugar de tener un solo `chokidar.watch`, se utilizará un mapa `this.watchers = new Map()` para rastrear múltiples archivos simultáneamente.
- **Dynamic Attach:** Al procesar las líneas, si el `watcher` detecta el evento `SUBAGENT_CREATED`, calculará la ruta del transcript del subagente. 
  - Primero intentará usar la ruta exacta indicada en `logAbsoluteUri`.
  - Como fallback, buscará la carpeta `conversationId` en el mismo directorio padre de la sesión actual.
- Al encontrarlo, creará una nueva instancia de `chokidar` para ese archivo y las nuevas acciones se emitirán con el `agentId` correcto hacia el frontend.

### C. Modificaciones en `simulator.js` (Modo Simulación)
- **Carga Recursiva:** Se cambiará el método de carga lineal por una función recursiva `loadTranscript(transcriptPath, agentId)`.
- **Merge y Sort:** Cuando detecte la creación de un subagente (`SUBAGENT_CREATED`), se pausará momentáneamente para localizar y cargar el `transcript.jsonl` del subagente. Todos los eventos extraídos se agregarán a la misma `eventsQueue`.
- Finalmente, antes de iniciar la reproducción, `eventsQueue` se ordenará globalmente por `timestamp`. De este modo, la simulación intercalará perfectamente los pensamientos del Team Leader con las acciones del subagente en orden cronológico, logrando un verdadero "Live Replay".

## 3. Pasos de Ejecución

- [ ] **Paso 1:** Actualizar la lógica de mapeo en `parser.js` para analizar correctamente los mensajes `GENERIC` de creación de subagentes.
- [ ] **Paso 2:** Refactorizar `watcher.js` para soportar múltiples instancias de chokidar y suscripción dinámica a nuevos archivos.
- [ ] **Paso 3:** Refactorizar `simulator.js` para cargar recursivamente archivos jsonl basándose en los UUIDs descubiertos y ordenar la cola resultante por fecha.
- [ ] **Paso 4:** Validar en la interfaz gráfica simulando la sesión `EPIC-004` (que contiene invocaciones) y verificar que en el panel lateral del agente aparezcan las acciones granulares (Thinking, etc.).

Al finalizar estos cambios, la telemetría del dashboard reflejará de forma real el esfuerzo y acciones de toda la red de agentes de Antigravity.
