# Proyecto: Gamified Agent Observability Dashboard

## 1. Visión General
El objetivo de este proyecto es construir un "Dashboard de Observabilidad" en tiempo real para un sistema orquestador multi-agente (Antigravity). A diferencia de un dashboard tradicional con gráficas aburridas, este tendrá un enfoque **gamificado** (estilo *Game Dev Story* o *Habbo Hotel*).

La interfaz mostrará una oficina virtual en 2D/Isométrica donde los agentes de IA estarán representados por avatares que interactúan con su entorno dependiendo de su estado de ejecución.

## 2. Fuentes de Datos (Telemetría)
Para que el juego sepa qué están haciendo los agentes sin sobrecargar los tokens (LLM), usaremos un enfoque híbrido de dos fuentes:

### A. Telemetría de Bajo Nivel (Motor Antigravity)
El sistema leerá en tiempo real (vía File Watcher) los archivos internos generados por el framework:
`\.gemini\antigravity\brain\<conversation-id>\.system_generated\logs\transcript.jsonl`

De aquí se extraerán eventos exactos del sistema:
- `tool_calls` -> El agente está usando una herramienta (ej. escribiendo código).
- `thinking` -> El agente está procesando una respuesta.
- `waiting_for_input` -> El agente se detuvo y necesita intervención humana.
- `invoke_subagent` -> Un nuevo agente fue llamado.

## 3. Mapeo de Animaciones y Eventos
El backend enviará estos eventos por WebSockets al frontend, el cual reaccionará con las siguientes animaciones:
1. **Spawn (Entrar a la oficina):** Se detecta `invoke_subagent`. Avatar entra y se sienta en escritorio libre.
2. **Trabajando (Tecleando):** Actividad de `tool_calls` o `thinking`. Avatar teclea.
3. **Bloqueo / Intervención Humana:** Estado `waiting_for_input`. Aparece globo de conversación pidiendo ayuda.
4. **Idle / Descanso:** Termina ciclo, sin actividad. Animación relax.
5. **Despawn (Abandonar oficina):** Agente es terminado. Sale de la oficina.

## 4. Stack Tecnológico
- **Backend:** Node.js + Express + `socket.io` + `chokidar`.
- **Frontend Core:** React.js / Vite.
- **Motor Gráfico:** Phaser.js.
- **Estilos UI:** TailwindCSS.

## 5. Especificaciones Técnicas y de Funcionalidad (Requerimientos)

### 5.1. Modelado de Datos (Payloads de WebSocket)
Esquema base de evento hacia el cliente:
```json
{
  "eventId": "uuid-1234",
  "timestamp": "2026-10-08T23:45:00Z",
  "agentId": "conversation-uuid-xyz",
  "agentRole": "dba_specialist",
  "state": "WORKING", 
  "metadata": { "toolInUse": "write_to_file" }
}
```

### 5.2. Máquina de Estados del Avatar
- **OFFLINE -> SPAWNING:** Al detectar `invoke_subagent`.
- **SPAWNING -> WORKING / IDLE:** Al sentarse en un escritorio.
- **CUALQUIERA -> WAITING_INPUT:** Prioridad alta. Muestra globo 💬 y espera interacción.
- **WAITING_INPUT -> WORKING:** Al recibir input del usuario.
- **CUALQUIERA -> ERROR:** Animación de humo en la PC por fallo de framework.
- **IDLE -> DESPAWNING:** (Ver sección 5.5).

### 5.3. Interactividad del Usuario (UI/UX)
1. **Click Inspect:** Hacer clic en avatar abre panel lateral (React) mostrando su `transcript` real.
2. **Resolución de Bloqueos:** El panel lateral permitirá enviar el input de respuesta cuando el estado sea `WAITING_INPUT`.

### 5.4. Reglas del Entorno Virtual (Oficina)
- **Pathfinding (A*):** Cálculo de rutas hacia escritorios.
- **Grid Isométrico:** Tiles estándar (ej. 64x32px), direcciones isométricas (SE, SW, NE, NW).

### 5.5. Ciclo de Vida de Inactividad (Combinación A + B)
Para evitar saturación visual si un agente queda huérfano:
1. **Inactividad Corta (Soft Idle):** Tras 3 minutos sin eventos, el avatar se levanta, libera el escritorio y camina hacia la **Sala de Descanso**.
2. **Inactividad Larga (Hard TTL / Despawn):** Si pasa 10 minutos adicionales en la sala de descanso sin ser llamado, el avatar camina a la salida y desaparece del lienzo.

### 5.6. Gestor de Sesiones Simple
Dado que Antigravity separa proyectos en carpetas (`brain/<uuid>`), se manejará un único proyecto visible a la vez para mantener simpleza:
1. **Auto-Discovery:** Node.js listará automáticamente las carpetas de sesiones.
2. **UI Selector Básico:** React tendrá un menú desplegable `<select>` para elegir la sesión.
3. **Limpieza de Oficina:** Al cambiar de sesión, Phaser "limpiará" la oficina (fade out de agentes actuales) y cargará el estado de la nueva sesión seleccionada.
