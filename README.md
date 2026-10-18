# Gamified Agent Observability Dashboard

![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![React](https://img.shields.io/badge/react-19.x-61dafb.svg)
![Phaser](https://img.shields.io/badge/phaser-3.x-red.svg)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-4.x-38B2AC.svg)
![Socket.IO](https://img.shields.io/badge/socket.io-4.x-black.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## 📖 Descripción Funcional

El **Gamified Agent Observability Dashboard** es un sistema innovador de monitoreo en tiempo real diseñado para el orquestador multi-agente Antigravity. Transforma la telemetría cruda en una experiencia interactiva inspirada en videojuegos top-down. Los agentes de IA se visualizan como avatares dentro de una oficina virtual; sus acciones, estados de procesamiento y requerimientos de intervención humana se traducen en comportamientos espaciales que facilitan el seguimiento de flujos multi-agente complejos.

### ✨ Características Principales
* **Avatar State Machine & Procedural Animations:** Representación visual de estados: SPAWNING (entrando), WORKING (tecleando en escritorio), WAITING_INPUT (globo de diálogo `⚠️`), IDLE (descanso en lounge con `💤`), DESPAWNING (salida por elevador). Animaciones procedurales con squash & stretch, partículas de pisadas y caminata direccional 4-vías.
* **Orientación Contextual de Puestos de Trabajo:** Soporte y respeto dinámico a la orientación asignada al asiento (`up`, `down`, etc.), alternando entre posturas frontales de trabajo o vistas de espaldas según el diseño del escritorio.
* **Gestión Visual de Inactividad y Espera:** Transición a estado de espera a partir de 1 minuto sin actividad con icono de reloj e indicador de minutos; preservación del contador de tiempo acumulado al desplazarse al lounge a descansar tras 5 minutos.
* **Modal Flotante de Telemetría (Hover HUD):** Tooltip interactivo de alto rendimiento (`z-[200]`) con hora de inicio persistente, tiempo total de trabajo, hora del último evento y contenedor de descripción con altura estática (4 líneas) para evitar parpadeos dimensionales.
* **Feed Lateral de Logs con Tooltip Extendido:** Inspección en profundidad de hasta 500 caracteres por cada log en la barra lateral con argumentos de herramientas, comandos de terminal ejecutados y archivos modificados.
* **Catálogo de Avatares y Variantes por Rol:** Spritesheets dedicados y procesados con IA para Tech Lead, Developer, QA Tester, Diseñadora, DBA Architect, Security Specialist y Documenter, con posturas contextuales (cuerpo completo en lounge vs. postura de trabajo en escritorio).
* **Soporte Multi-Agente Recursivo y Robusto:** Auto-descubrimiento y enganche a los logs de subagentes generados dinámicamente en tiempo real, con discriminación estricta de tareas en background para evitar falsos positivos.
* **Motor Dual de Reproducción:**
  * **Simulador Histórico:** Reproducción de sesiones pasadas con acelerador de tiempo (1x a 10x) y barra de tiempo scrubbable.
  * **Live Watcher:** Monitoreo en tiempo real reaccionando a los archivos de log directamente en disco.
* **Inspector React (Agent HUD) & Modo Maximizado:** Panel lateral deslizable para visualizar terminal interna, pensamientos, herramientas y responder preguntas humanas. Modo maximizado contenido que amplía el lienzo al 100% del contenedor manteniendo la barra lateral accesible.
* **Editor de Oficina Dual (Objetos y Estructuras):** Personalización en caliente de estaciones de trabajo, muebles, paredes y pisos celda por celda (32x32) con brocha continua (drag-to-paint), atajo de rotación (`R`) y catálogos desacoplados para alto rendimiento.

---

## 📸 Interfaz Gráfica

*(Agrega aquí tus capturas de pantalla)*
* `![Oficina Virtual](/frontend/src/assets/oficina_demo.png)`
* `![Panel HUD de Agente](/frontend/src/assets/hud_demo.png)`

---

## 🛠️ Requisitos de Entorno

- **Node.js:** v18.0.0 o superior (recomendado v20+).
- **NPM:** v9.0.0 o superior.
- Navegador moderno compatible con **WebGL** (Chrome, Edge, Firefox).
- Orquestador **Antigravity** generando logs en la carpeta local `.gemini/antigravity/brain/`.

### Variables de Entorno (`.env`)
*(Añadir al archivo `.env` en la carpeta `backend/` si es necesario, actualmente el sistema usa puertos fijos pero se pueden sobreescribir)*
```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## 🚀 Guía de Instalación y Uso Rápido

### 1. Clonar e Instalar
```bash
git clone https://github.com/Marvinilt/dashboard-agents.git
cd dashboard-agents

# Instalar Backend
cd backend
npm install

# Instalar Frontend
cd ../frontend
npm install
```

### 2. Ejecutar la Plataforma
Abre dos terminales:

**Terminal 1 (Backend):**
```bash
cd backend
npm start
```
*(El backend arranca en el puerto 3001 y expone WebSockets)*

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
Abre en tu navegador la URL: `http://localhost:5173`.

### 3. Uso Rápido
1. Usa el **desplegable superior** para seleccionar una sesión activa o de ejemplo.
2. Haz clic en un **avatar** para abrir el Panel Lateral (HUD) y ver sus logs o responder a solicitudes pendientes.
3. Utiliza los controles de **reproducción** (Play, Pausa, x1, x5) si estás en modo Simulación.

---

## 🤝 Cómo Contribuir

1. Haz un **Fork** del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-animacion`).
3. Realiza tus commits respetando Semantic Versioning (`git commit -m 'feat: añade nueva animación de descanso'`).
4. Haz push a la rama (`git push origin feature/nueva-animacion`).
5. Abre un **Pull Request**.

Lee nuestro `CHANGELOG.md` y `docs/documentacionTecnica.md` para entender la arquitectura antes de realizar cambios estructurales.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más información.
