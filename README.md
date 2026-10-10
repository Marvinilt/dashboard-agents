# 🏢 Agent Virtual HQ (Dashboard Agents)

> **Observabilidad gamificada en tiempo real para orquestadores multi-agente de Inteligencia Artificial.**

`Agent Virtual HQ` es una plataforma interactiva que transforma los registros de telemetría y transcripciones de ejecución (`transcript.jsonl`) generados por orquestadores de IA (como Google Gemini / Antigravity) en una **oficina virtual 2D isométrica**. Permite monitorear el comportamiento de agentes autónomos, sus estados de trabajo, el ciclo de vida de los subagentes especializados y responder a bloqueos que requieran intervención humana.

---

## 🚀 Características Principales

* **🎮 Oficina Virtual Isométrica 2D (Phaser 4):**
  * Cuadrícula de oficina con puestos de trabajo ergonómicos, puerta de entrada (`Spawn Portal`) y zona de descanso (`Coffee Break`).
  * Desplazamiento animado de avatares hacia sus escritorios asignados con animaciones de balanceo y respiración.
  * Transición automática a la sala de descanso tras inactividad prolongada y retorno al detectar nuevas tareas.

* **👥 Avatares Procedimentales con Roles Especializados:**
  * **Team Leader (Orquestador):** Corona dorada, atuendo celeste neón.
  * **UI/UX Designer:** Boina magenta, atuendo coral (`designer`).
  * **Arquitecto DBA:** Gafas y corbatín naranja, atuendo ámbar (`dba`).
  * **Senior Full-Stack Developer:** Headset gamer con micrófono, atuendo azul (`developer`).
  * **QA SDET & Testing:** Lupa de inspección, atuendo verde esmeralda (`qa_tester`).
  * **Auditor de Seguridad:** Gafas oscuras de agente secreto, atuendo rojo (`security`).
  * **Documentador Técnico:** Gafas de lectura y libreta, atuendo violeta (`documenter`).

* **⚡ Motor Dual de Reproducción:**
  * **Simulador Histórico:** Reproduce sesiones completadas con control de velocidad dinámico (`1x`, `2x`, `3x`, `5x`, `10x`) y cálculo proporcional de latencia real.
  * **Live Watcher:** Monitoreo en tiempo real mediante `chokidar` con detección reactiva de nuevas líneas en `transcript.jsonl`.

* **📊 Panel Lateral de Telemetría (Agent HUD):**
  * Métricas por agente: hora de inicio de actividad, contador de acciones y badge de estado (`WORKING`, `THINKING`, `WAITING_INPUT`, `RESTING`, `ERROR`).
  * Feed de eventos y llamadas a herramientas terminales (`run_command`, `view_file`, `write_to_file`, etc.).
  * **Intervención Humana en Vivo:** Formulario de respuesta directa cuando un agente solicita confirmación o interacción del usuario (`WAITING_FOR_INPUT`).

* **📂 Explorador Dinámico de Sesiones:**
  * Integración automática con el directorio `brain` del sistema (`~/.gemini/antigravity/brain`).
  * Selector ordenado cronológicamente por sesiones más recientes.
  * Soporte para explorar y escanear cualquier ruta local del disco duro.

---

## 📁 Estructura del Proyecto

```text
DashboardAgents/
├── backend/
│   ├── mock_data/               # Copia local de sesiones para pruebas sin conexión
│   ├── src/
│   │   ├── parser.js            # Normalizador semántico de eventos y detección de roles/subagentes
│   │   ├── server.js            # Servidor HTTP Express y Socket.io WebSockets
│   │   ├── simulator.js         # Motor de simulación con aceleración de reproducción
│   │   ├── watcher.js           # Live Watcher reactivo con Chokidar
│   │   └── test_reader.js       # Script de verificación de lectura de eventos
│   └── package.json
│
├── frontend/
│   ├── public/                  # Íconos y activos estáticos
│   ├── src/
│   │   ├── assets/              # Activos visuales adicionales
│   │   ├── components/
│   │   │   ├── AgentSidebar.jsx # Panel lateral expandible de telemetría y chat humano
│   │   │   ├── PhaserGame.jsx   # Contenedor React para el canvas del juego
│   │   │   └── SessionSelector.jsx # Barra superior de control y selector de sesión
│   │   ├── game/
│   │   │   ├── assets.js        # Generador de texturas procedimentales pixel art
│   │   │   ├── Avatar.js        # Clase Phaser.GameObjects.Container para sprites y accesorios
│   │   │   ├── eventBus.js      # Bus de eventos desacoplado entre Phaser y React
│   │   │   └── OfficeScene.js   # Escena isométrica de la oficina y ciclo de vida de escritorios
│   │   ├── App.jsx              # Vista principal, conexión WebSockets y contadores HUD
│   │   ├── index.css            # Configuración de Tailwind CSS y tipografía
│   │   └── main.jsx             # Punto de entrada de React
│   ├── vite.config.js
│   └── package.json
│
├── Conversaciones ejemplo/      # Directorio con la sesión multi-agente de referencia
│   └── 29081f31-6f31-43f8-96d6-8ea576052c5f/
│       └── .system_generated/logs/transcript.jsonl
│
├── Documento_Requerimientos_General.md # Especificación formal y requerimientos del sistema
├── Plan_Implementacion.md              # Plan de arquitectura y fases del proyecto
├── .gitignore                          # Configuración de exclusión para Git
└── README.md                           # Documentación principal del proyecto
```

---

## 🛠️ Requisitos Previos

* **Node.js:** v18.0.0 o superior (recomendado v20+)
* **NPM:** v9.0.0 o superior
* Navegador moderno compatible con WebGL (Chrome, Edge, Firefox, Brave)

---

## 📦 Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd DashboardAgents
   ```

2. **Instalar dependencias del Backend:**
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Instalar dependencias del Frontend:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

---

## 🚦 Ejecución en Desarrollo

Para ejecutar la plataforma completa se deben iniciar ambos servicios:

### 1. Iniciar el Backend (Puerto 3001)
```bash
cd backend
npm start
```
El servidor arrancará en `http://localhost:3001` exponiendo la API REST y el canal WebSockets.

### 2. Iniciar el Frontend (Puerto 5173 / 5174)
En una terminal independiente:
```bash
cd frontend
npm run dev
```
Abre la URL indicada en la consola (por defecto `http://localhost:5173` o `http://localhost:5174`) en tu navegador web.

---

## 🎯 Guía de Uso del Dashboard

1. **Seleccionar una Sesión:**
   * Utiliza el menú desplegable en la barra superior.
   * Selecciona `[Ejemplos] Multi-Agente: Orquestador EPIC-004` para reproducir la orquestación completa del equipo de ingeniería.
2. **Controlar la Reproducción:**
   * Usa los botones **Pausar / Reanudar** para detener el flujo en cualquier momento.
   * Cambia el selector de velocidad a `1x`, `3x`, `5x` o `10x` para acelerar el análisis de sesiones largas.
3. **Alternar entre Modos:**
   * **Simulador:** Para analizar registros pasados.
   * **Live Watcher:** Para conectarse a una sesión de orquestación que esté corriendo en vivo en tu máquina.
4. **Inspeccionar un Agente:**
   * Haz clic sobre cualquier avatar en la oficina virtual.
   * Se abrirá el panel lateral izquierdo mostrando los detalles del rol, el historial de herramientas utilizadas y su estado actual.
5. **Responder a Bloqueos:**
   * Cuando un avatar muestre el ícono `❗` (*WAITING_INPUT*), selecciónalo e introduce la respuesta en el campo inferior del panel lateral para desbloquear su ejecución.

---

## 📡 API y Eventos WebSocket

### Endpoints REST
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/sessions` | Obtiene la lista unificada de sesiones disponibles ordenadas por fecha. |
| `POST` | `/api/sessions/select` | Selecciona y activa una sesión (`sessionId`, `mode`, `speed`). |
| `POST` | `/api/sessions/set-directory` | Configura una ruta de carpeta personalizada para escanear sesiones. |
| `POST` | `/api/simulator/control` | Controla la reproducción (`action`: `'play'` \| `'pause'`, `speed`: número). |

### Eventos WebSocket (Socket.io)
* **Servidor ➔ Cliente:**
  * `SERVER_READY`: Envía estado inicial del motor y sesión activa.
  * `AGENT_EVENT`: Notifica eventos semánticos normalizados (Spawns, ejecuciones de herramientas, cambios de estado).
  * `SESSION_CHANGED`: Notifica a los clientes la transición a una nueva sesión.
  * `SIMULATION_COMPLETED`: Notifica la conclusión de la reproducción histórica.
* **Cliente ➔ Servidor:**
  * `USER_RESPONSE_INPUT`: Envía la respuesta o autorización del usuario para un agente bloqueado.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo `LICENSE` si aplica para más detalles.

