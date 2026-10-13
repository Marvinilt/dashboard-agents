# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-10-13

### Fixed
- **Corrección en spawn y desplazamiento inicial de avatares:**
  - Se eliminó la interrupción del tween de aparición (`SpawningState`) que forzaba a los avatares a entrar en `IDLE` en el punto de inicio (elevador) y cancelaba la ruta de caminata.
  - Asignación inmediata de la estación de trabajo y ejecución directa de navegación (`goToWorkstation`) al instanciarse el avatar.
  - Preservación de la postura de pie en movimiento (`applyStandingFrame`), impidiendo que tomen prematuramente la pose de escritorio frontal sin piernas en el elevador.
  - Transición garantizada a la pose de trabajo (`applySeatedFrame` con `avatares_working`) al llegar físicamente al escritorio asignado.
  - Posicionamiento inmediato de los avatares en sus escritorios durante saltos de simulación (`isJumpReplay`) en `OfficeScene.js`.

## [1.5.0] - 2026-10-11

### Added
- **Spritesheet unificado de variantes de escritorio (`avatares_working_sprite.png`):** Generación y alineación en cuadrícula 3x2 (celdas de `688 × 768 px`) con recorte por IA de los 6 personajes en pose de escritorio (teclado en mesa, sin piernas visibles):
  - Fila 0: QA Tester (Frame 0), Developer (Frame 1), Diseñadora (Frame 2).
  - Fila 1: DBA (Frame 3), Security (Frame 4), Documenter (Frame 5).
- **Mapeo contextual en FSM (`ROLE_TO_WORKING_FRAME`):** En `Avatar.js`, al sentarse frente al escritorio (`isDesk: true, dir: 'down'`), cada rol adopta instantáneamente su respectivo frame de trabajo. Al descansar en el sofá (`isDesk: false`), se mantiene la postura de cuerpo completo con piernas visibles.

## [1.4.0] - 2026-10-11

### Added
- **Marco perimetral completo de paredes (`office_walls.png`):** Integración de paredes norte (fondo) y laterales en una sola textura transparente de alta definición superpuesta en capa `depth = -3`.
- **Limpieza algorítmica de fondos (BFS):** Algoritmo en Python para supresión automática de fondos blancos y sombras proyectadas, ajustando el umbral al límite exacto de zócalos y molduras (`RGB ~35`).

### Changed
- **Proporciones integradas del lienzo (`928 × 576 px`):** Extensión perimetral del viewport (+64px superior, +32px laterales) y calibración del scroll de cámara a `(-32, -64)` para enmarcar el espacio de juego sin alterar las coordenadas de la cuadrícula ni los props.

### Removed
- **Diseño estructural hardcodeado (Blockout / Greybox):** Depuración total de geometrías heredadas en `OfficeScene.js`: recuadro cian del despacho del líder, muros divisorios oscuros, sombras de muebles, resplandor de TV y gráficos provisionales del elevador.
- **Colisiones fijas predeterminadas:** Eliminación de los obstáculos hardcodeados en el NavGrid para que la navegación dependa 100% del layout dinámico y el editor de colisiones.

## [1.3.0] - 2026-10-11

### Added
- **Pipeline automatizado de spritesheets (rembg + Pillow):** Script en Python (`scripts/process_avatar.py`) para ingestión, eliminación de fondo con IA y recorte/alineación de character sheets en PNG transparente.
- **Catálogo completo de avatares:** Procesamiento y carga de spritesheets para toda la plantilla: Team Leader, Diseñadora, Developer, DBA, QA, Seguridad y Documentador.
- **Mapeo semántico de roles (`agentMapper.js`):** Normalización de palabras clave desde logs en tiempo real hacia roles estándar (`ROLE_TO_SPRITE`) con fallback visual a prueba de fallos.
- **Orientación direccional de estaciones (Tecla `R`):** Nodos de trabajo y descanso con atributo `direction`, flecha indicadora visual en el editor y rotación cíclica de 90° con atajo `R`.
- **Variación de escritorio frontal vs. Sofá:** Detección contextual de superficie: en escritorio frontal (`dir: down`) se utiliza la variación sin piernas tecleando (`dev_desk_sprite`), mientras que en el sofá del lounge se preserva el cuerpo completo con piernas visibles.

### Changed
- **Escala base ampliada (`AVATAR_SCALE = 0.085`):** Incremento de ~21% en el tamaño de todos los avatares, con ajuste automático de sombras (`30x14`), hitboxes (`40x56`), etiquetas (`y = -44`) y burbujas HUD (`y = -60`).
- **Ciclo de descanso unificado para el Team Leader:** Eliminación de excepciones de inactividad; el líder ahora también camina hacia el lounge a descansar cuando no hay actividad.

### Fixed
- **Persistencia de postura sentado en escritorio:** Métodos centralizados `applySeatedFrame` y `applyStandingFrame` para evitar que los agentes se paren sobre su silla al alternar entre estados `WORKING`, `THINKING`, `WAITING_INPUT` e `IDLE`.
- **Supresión de figuras geométricas:** Eliminación definitiva de rectángulos y círculos temporales en favor de sprites renderizados.

## [1.2.0] - 2026-10-11

### Added
- **Modal flotante en hover de avatares:** Tooltip HUD interactivo que muestra nombre/rol, tiempo de espera en minutos desde su último log y el contenido del registro más reciente.
- **Modo de edición de estructuras:** Herramienta para pintar suelos y paredes celda por celda (32x32) con brocha continua (drag-to-paint) y rotación con `R` en capa de fondo.
- **Animaciones procedurales de avatares:**
  - *Caminata:* Squash & stretch al pisar, inclinación dinámica (*tilt/sway*) según dirección y partículas de pisadas en el suelo.
  - *Trabajo en escritorio:* Micro-movimientos de tecleo, globo `💭` flotante y destellos de monitor en estaciones activas.
  - *Descanso en lounge:* Postura reclinada, respiración profunda y emisión de letras `z` luminosas flotantes.
  - *Pensando y espera:* Balanceo reflexivo lento y oscilación de impaciencia con icono `⚠️`.
- **Caminata direccional 4-vías:** Orientación automática del sprite en 4 direcciones (frente, espalda, derecha, izquierda) durante el desplazamiento.

### Changed
- **Vista maximizada contenida del lienzo:** En lugar de superponer un modal de pantalla completa sobre todo el sitio (`fixed inset-0`), el lienzo se expande dentro de su contenedor principal (`w-full h-full flex-1`), permitiendo mantener abierta y visible la barra lateral con los logs de los avatares en alta resolución.
- **Reorganización modular de assets:** División en carpetas `/backgrounds`, `/estructura` y `/objetos`, eliminando escaneo recursivo pesado para acelerar la carga de catálogos.
- **Iconografía minimalista de estados:** Eliminación de textos redundantes ("trabajando", "caminando") en favor de iconos discretos (`💭`, `💤`, `⚠️`) solo cuando hay actividad.
- **Alternancia y colapso del panel lateral:** Clic sobre el avatar seleccionado contrae el panel de detalle; clic sobre otro avatar conmuta y expande fluidamente.

### Fixed
- **Deduplicación y fuga de logs entre agentes:** Limpieza absoluta del panel al cambiar de agente, llaves DOM aisladas por `agentId` y generación de `eventId` único garantizado en el backend.
- **Mapeo de sprite del Documentador:** Vinculación exacta de `document_sprite.png` para roles documentadores/docs, evitando la asignación por defecto.
- **Estabilidad de cámara en edición:** Supresión de saltos de cámara al soltar o pintar objetos y estructuras en el lienzo.

## [1.1.0] - 2026-10-11

### Added
- **Pared de fondo con profundidad y transparencia:** Procesamiento de `bg_wall.png` con recorte de fondo blanco y traslape de 20px sobre el piso para otorgar perspectiva detrás de los objetos.
- **Botón directo de explorador de carpetas:** Acceso rápido junto al selector de sesiones para abrir el diálogo nativo de carpetas de Windows.
- **ResizeObserver en Phaser:** Ajuste y centrado automático del lienzo en tiempo real al expandir o colapsar paneles laterales.

### Changed
- **Barra lateral de telemetría fluida:** Transición de modal fijo a layout `flex` estructural que empuja suavemente el sitio hacia la derecha sin tapar el escenario.
- **Barras superiores compactas:** Reducción de altura en la cabecera y eliminación de la sección redundante de exploración de carpetas.
- **Umbrales de inactividad realistas:** Ajuste a 2 minutos para descanso en Lounge y 10 minutos para despawn por elevador, adaptados a los tiempos de respuesta de LLMs.

### Fixed
- **Detección y concurrencia de subagentes:** Soporte para herramientas concurrentes y delimitación estricta de roles por regex (`\bui\b`) para identificar correctamente al Arquitecto DBA.
- **Control y arrastre del timeline:** Solución al congelamiento del slider (`onPointerLeave`) y sincronización continua del progreso.
- **Ciclo y botón de simulación:** Escucha de `SIMULATION_COMPLETED` para mostrar el botón verde "Iniciar" al finalizar e impedir auto-reproducción no deseada al cargar sesiones.
- **Cálculo de inactividad en saltos de tiempo:** Aislamiento del tiempo global (`isJumpReplay`) para evaluar descansos y salidas de agentes con exactitud.
- **Escala de pared de fondo:** Dimensionamiento restringido de la pared norte para evitar la ocultación del piso del escenario.

## [1.0.0] - 2026-10-10

### Added
- **Gamified Visual Engine:** Implementación completa del dashboard con el motor gráfico Phaser en vista isométrica.
- **Backend Telemetry:** Sistema de lectura y parcheo de logs de Antigravity en tiempo real y modo simulación.
- **Multi-Agent Recursive Parser:** Soporte automático para detectar e integrarse a la creación dinámica de subagentes en tiempo real.
- **Agent HUD Sidebar:** Componente de React deslizable para visualizar la terminal interna del agente (`tool_calls`, pensamientos) y su estado.
- **Human-in-the-Loop Integration:** Interfaz interactiva en el panel lateral para destrabar agentes en estado `WAITING_INPUT`.
- **Customizable Environment:** Editor UI interactivo (drag-and-drop / rotación) para reorganizar y diseñar la disposición de escritorios y decoración de la oficina.
- **Advanced State Machine:** Animaciones conectadas a eventos semánticos (Spawning, Working, Waiting, Idle, Despawning).

### Changed
- Refactorización de la estructura central para separar el framework Phaser (`Canvas`) de la capa UI en React.
- Transición a TailwindCSS para todos los componentes de interfaz.

