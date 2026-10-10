import Phaser from 'phaser';
import * as EasyStar from 'easystarjs';
import { generateProceduralTextures } from './assets.js';
import { Avatar } from './Avatar.js';
import { gameEvents, EVENTS } from './eventBus.js';

import deskImg from '../assets/desk.png';
import deskTlImg from '../assets/desk_tl.png';
import sofaImg from '../assets/sofa.png';

// =======================================================
// Configuración de la Cuadrícula (Top-Down Orthogonal)
// =======================================================
export const GRID_SIZE = 32; // Cada celda mide 32x32 píxeles
export const COLS = 27;      // Ancho: 27 * 32 = 864px
export const ROWS = 16;      // Alto: 16 * 32 = 512px

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super('OfficeScene');
    this.agents = new Map();
    
    // Nodos de interacción lógicos (coordenadas de celdas)
    this.desks = [];
    this.loungeSpots = [];
    
    this.doorGridPos = { col: 2, row: 15 }; // Elevador abajo a la izquierda
    this.finder = new EasyStar.js();
  }

  preload() {
    generateProceduralTextures(this);
    this.load.image('prop_desk', deskImg);
    this.load.image('prop_desk_tl', deskTlImg);
    this.load.image('prop_sofa', sofaImg);
  }

  create() {
    // 1. Dibujar piso base
    this.createFloorPattern();

    // 2. Dibujar las áreas de la oficina (Blockout / Greyboxing)
    this.drawGreyboxLayout();

    // 3. Setup de NavGrid y Obstáculos
    this.setupPathfinding();

    // 4. Elevador (Punto de aparición)
    this.createElevator();

    // Eventos
    this.events.on('AGENT_CLICKED', (avatar) => {
      gameEvents.emit(EVENTS.AGENT_SELECTED, {
        agentId: avatar.agentId,
        agentRole: avatar.agentRole,
        state: avatar.state
      });
    });

    console.log('[Phaser] Blockout estructural (Greybox) renderizado.');
  }

  update() {
    // Procesar cola de pathfinding (EasyStar no bloquea el hilo principal)
    this.finder.calculate();
    
    // Actualizar agentes
    this.agents.forEach(a => a.update());
  }

  // ==========================================
  // Pathfinding (NavGrid)
  // ==========================================
  setupPathfinding() {
    this.navGrid = [];
    for (let r = 0; r < ROWS; r++) {
      let row = [];
      for (let c = 0; c < COLS; c++) {
        row.push(0); // 0 = Caminable
      }
      this.navGrid.push(row);
    }

    const addObstacle = (col, row, width, height) => {
      for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) {
          if (this.navGrid[r] && this.navGrid[r][c] !== undefined) {
             this.navGrid[r][c] = 1; // 1 = Obstáculo
          }
        }
      }
    };

    // Obstáculos basados en el Layout
    addObstacle(1, 1, 4, 2); // Escritorio L TL monitores principales
    addObstacle(1, 3, 1, 2); // Escritorio L TL retorno ala izquierda

    addObstacle(18, 0, 1, 6); // Muro divisorio sup
    addObstacle(18, 9, 1, 7); // Muro divisorio inf

    // Islas centrales
    const islandPositions = [
      { col: 7, row: 3 }, { col: 13, row: 3 },
      { col: 7, row: 10 }, { col: 13, row: 10 }
    ];
    islandPositions.forEach(pos => {
      addObstacle(pos.col, pos.row, 3, 2);
      // Registrar asientos de escritorio
      this.desks.push({ col: pos.col, row: pos.row - 1 });
      this.desks.push({ col: pos.col + 2, row: pos.row - 1 });
      this.desks.push({ col: pos.col, row: pos.row + 2 });
      this.desks.push({ col: pos.col + 2, row: pos.row + 2 });
    });

    // Escritorio Team Leader (Silla ejecutiva frente a los monitores)
    this.tlDesks = [{ col: 2, row: 3 }];

    // Lounge
    addObstacle(23, 1, 4, 1); // Barra
    addObstacle(21, 4, 4, 1); // Sofá U
    addObstacle(24, 5, 1, 2); // Sofá U brazo
    addObstacle(21, 8, 3, 1); // Sofá 3
    addObstacle(25, 7, 1, 1); // Butaca
    addObstacle(26, 9, 1, 1); // Butaca
    addObstacle(21, 6, 1, 1); // Butaca
    
    addObstacle(23, 6, 1, 1); // Mesa
    addObstacle(24, 9, 1, 1); // Mesa
    
    addObstacle(26, 13, 1, 3); // Pared TV
    addObstacle(22, 13, 2, 2); // Sofá Gamer

    // Registrar asientos del Lounge (Espacios caminables colindantes a los sofás)
    this.loungeSpots = [
      { col: 23, row: 2 }, { col: 24, row: 2 }, { col: 26, row: 2 }, // Taburetes
      { col: 21, row: 5 }, { col: 22, row: 5 }, // Centro del Sofá U
      { col: 22, row: 9 }, // Frente al sofá 3
      { col: 21, row: 13 }, { col: 21, row: 14 } // Viendo la TV
    ];

    // Configurar EasyStar
    this.finder.setGrid(this.navGrid);
    this.finder.setAcceptableTiles([0]);
    this.finder.enableDiagonals();
    this.finder.disableCornerCutting();
  }

  getRandomDesk(role) {
    if (role === 'team_leader') {
      return this.tlDesks[0]; // Solo hay 1 silla principal
    }

    const occupied = new Set();
    this.agents.forEach(a => {
      if (a.assignedDesk) occupied.add(`${a.assignedDesk.col},${a.assignedDesk.row}`);
    });

    const freeDesks = this.desks.filter(d => !occupied.has(`${d.col},${d.row}`));
    if (freeDesks.length === 0) return this.desks[Math.floor(Math.random() * this.desks.length)];
    return freeDesks[Math.floor(Math.random() * freeDesks.length)];
  }

  getRandomLoungeSpot() {
    const occupied = new Set();
    this.agents.forEach(a => {
      if (a.assignedLounge) occupied.add(`${a.assignedLounge.col},${a.assignedLounge.row}`);
    });

    const freeSpots = this.loungeSpots.filter(s => !occupied.has(`${s.col},${s.row}`));
    if (freeSpots.length === 0) return this.loungeSpots[Math.floor(Math.random() * this.loungeSpots.length)];
    return freeSpots[Math.floor(Math.random() * freeSpots.length)];
  }

  // ==========================================
  // Piso, Texturas y Efectos Base
  // ==========================================
  createFloorPattern() {
    // 1. Textura en mosaico para la Oficina (0 a 18 columnas)
    this.add.tileSprite(0, 0, 18 * GRID_SIZE, ROWS * GRID_SIZE, 'floor_tile').setOrigin(0, 0);
    
    // 2. Textura en mosaico para el Lounge (18 a 27 columnas)
    this.add.tileSprite(18 * GRID_SIZE, 0, 9 * GRID_SIZE, ROWS * GRID_SIZE, 'lounge_tile').setOrigin(0, 0);

    // 3. Líneas Neón en el suelo (Cyberpunk vibes)
    const neonCyan = this.add.graphics();
    neonCyan.lineStyle(3, 0x06b6d4, 0.9);
    neonCyan.beginPath();
    
    // Ruta desde elevador hacia arriba, luego por el pasillo central, baja hacia la derecha
    neonCyan.moveTo(3 * GRID_SIZE, 15.5 * GRID_SIZE);
    neonCyan.lineTo(3 * GRID_SIZE, 8 * GRID_SIZE);
    neonCyan.lineTo(17 * GRID_SIZE, 8 * GRID_SIZE);
    neonCyan.lineTo(17 * GRID_SIZE, 14 * GRID_SIZE);
    neonCyan.strokePath();
    neonCyan.setBlendMode(Phaser.BlendModes.ADD);

    // Ruta naranja superior (hacia TL y Lounge)
    const neonOrange = this.add.graphics();
    neonOrange.lineStyle(3, 0xf97316, 0.8);
    neonOrange.beginPath();
    neonOrange.moveTo(3 * GRID_SIZE, 7.5 * GRID_SIZE);
    neonOrange.lineTo(3 * GRID_SIZE, 1.5 * GRID_SIZE);
    neonOrange.lineTo(17 * GRID_SIZE, 1.5 * GRID_SIZE);
    neonOrange.strokePath();
    neonOrange.setBlendMode(Phaser.BlendModes.ADD);
  }

  // ==========================================
  // Layout Estructural (Blockout Visual)
  // ==========================================
  drawGreyboxLayout() {
    this.layoutGraphics = this.add.graphics();

    // Sombra del Muro Divisorio Central
    this.layoutGraphics.fillStyle(0x000000, 0.5);
    this.layoutGraphics.fillRect(18 * GRID_SIZE + 6, 6, 1 * GRID_SIZE, 6 * GRID_SIZE);
    this.layoutGraphics.fillRect(18 * GRID_SIZE + 6, 9 * GRID_SIZE + 6, 1 * GRID_SIZE, 7 * GRID_SIZE);

    // --- A. Oficina del Team Leader (Arriba Izquierda) ---
    // Suelo tintado
    this.layoutGraphics.fillStyle(0x0284c7, 0.1); 
    this.layoutGraphics.fillRect(0, 0, 6 * GRID_SIZE, 7 * GRID_SIZE);
    
    // Paredes de "vidrio" simuladas con borde brillante cian
    this.layoutGraphics.lineStyle(2, 0x22d3ee, 0.5); 
    this.layoutGraphics.strokeRect(0, 0, 6 * GRID_SIZE, 7 * GRID_SIZE);
    
    // Escritorio L de Alta Fidelidad del Team Leader
    const tlDeskSprite = this.add.image(1 * GRID_SIZE, 1 * GRID_SIZE, 'prop_desk_tl').setOrigin(0, 0);
    tlDeskSprite.setDisplaySize(4.2 * GRID_SIZE, 3.2 * GRID_SIZE);

    // Mesa visitas TL
    this.layoutGraphics.fillStyle(0x334155, 1);
    this.layoutGraphics.fillCircle(4 * GRID_SIZE, 5 * GRID_SIZE, 15);
    this.layoutGraphics.fillRect(2.5 * GRID_SIZE, 4.5 * GRID_SIZE, 1 * GRID_SIZE, 1 * GRID_SIZE); // Sillón pequeño

    // --- B. Muro Divisorio Central-Derecho ---
    this.layoutGraphics.fillStyle(0x0f172a, 1); // Color slate muro oscuro
    this.layoutGraphics.fillRect(18 * GRID_SIZE, 0, 1 * GRID_SIZE, 6 * GRID_SIZE);
    this.layoutGraphics.fillRect(18 * GRID_SIZE, 9 * GRID_SIZE, 1 * GRID_SIZE, 7 * GRID_SIZE);

    // --- C. Islas Centrales (4 islas de 3x2) ---
    const islandPositions = [
      { col: 7, row: 3 },  { col: 13, row: 3 },
      { col: 7, row: 10 }, { col: 13, row: 10 }
    ];

    islandPositions.forEach(pos => {
      const pxX = pos.col * GRID_SIZE;
      const pxY = pos.row * GRID_SIZE;
      
      // Sombra suave proyectada para la isla de trabajo
      const deskShadow = this.add.graphics();
      deskShadow.fillStyle(0x000000, 0.35);
      deskShadow.fillRoundedRect(pxX + 4, pxY + 4, 3 * GRID_SIZE, 2 * GRID_SIZE, 6);

      // Sprite de escritorio de alta fidelidad
      const deskSprite = this.add.image(pxX, pxY, 'prop_desk').setOrigin(0, 0);
      deskSprite.setDisplaySize(3 * GRID_SIZE, 2 * GRID_SIZE);
    });

    // --- D. Lounge (Lado Derecho) ---
    // Barra de Café
    this.layoutGraphics.fillStyle(0x000000, 0.4); // Sombra
    this.layoutGraphics.fillRect(23 * GRID_SIZE + 4, 1 * GRID_SIZE + 4, 4 * GRID_SIZE, 1 * GRID_SIZE);
    this.layoutGraphics.fillStyle(0x451a03, 1); // Madera oscura barra
    this.layoutGraphics.fillRect(23 * GRID_SIZE, 1 * GRID_SIZE, 4 * GRID_SIZE, 1 * GRID_SIZE);
    this.layoutGraphics.fillStyle(0xf59e0b, 1); // Taburetes naranjas
    [23.5, 24.8, 26.1].forEach(col => {
      this.layoutGraphics.fillCircle(col * GRID_SIZE, 2.5 * GRID_SIZE, 8);
    });

    // Zona de Charlas Múltiple
    // Sombra suave para el Sofá U
    const sofaShadow = this.add.graphics();
    sofaShadow.fillStyle(0x000000, 0.35);
    sofaShadow.fillRoundedRect(21 * GRID_SIZE + 4, 4 * GRID_SIZE + 4, 4.5 * GRID_SIZE, 3 * GRID_SIZE, 8);

    // Sofá U de Alta Fidelidad (incluye mesa de centro con taza de café)
    const sofaSprite = this.add.image(21 * GRID_SIZE, 4 * GRID_SIZE, 'prop_sofa').setOrigin(0, 0);
    sofaSprite.setDisplaySize(4.5 * GRID_SIZE, 3 * GRID_SIZE);
    
    // Sofá de 3 plazas extra
    this.add.image(21 * GRID_SIZE, 8 * GRID_SIZE, 'sofa_3_prop').setOrigin(0, 0);

    // Butacas individuales
    this.add.image(25 * GRID_SIZE, 7 * GRID_SIZE, 'butaca_prop').setOrigin(0, 0);
    this.add.image(26 * GRID_SIZE, 9 * GRID_SIZE, 'butaca_prop').setOrigin(0, 0);
    this.add.image(21 * GRID_SIZE, 6 * GRID_SIZE, 'butaca_prop').setOrigin(0, 0);
    
    // Mesita de centro para las butacas
    this.layoutGraphics.fillStyle(0x334155, 1); 
    this.layoutGraphics.fillCircle(24 * GRID_SIZE, 9 * GRID_SIZE, 12);

    // Zona Gaming
    this.layoutGraphics.fillStyle(0x0f172a, 1); // Pared de TV oscura
    this.layoutGraphics.fillRect(26.5 * GRID_SIZE, 13 * GRID_SIZE, 0.5 * GRID_SIZE, 3 * GRID_SIZE);
    
    // Glow de la TV
    const tvGlow = this.add.graphics();
    tvGlow.fillStyle(0x38bdf8, 0.15);
    tvGlow.fillCircle(25.5 * GRID_SIZE, 14.5 * GRID_SIZE, 40);
    tvGlow.setBlendMode(Phaser.BlendModes.ADD);

    this.layoutGraphics.fillStyle(0x38bdf8, 1); // Pantalla TV
    this.layoutGraphics.fillRect(26.3 * GRID_SIZE, 13.2 * GRID_SIZE, 0.2 * GRID_SIZE, 2.6 * GRID_SIZE);
    
    // Sofá Gamer
    this.add.image(22 * GRID_SIZE, 13.5 * GRID_SIZE, 'sofa_gamer_prop').setOrigin(0, 0);
  }

  createElevator() {
    const pxX = this.doorGridPos.col * GRID_SIZE + (GRID_SIZE/2);
    const pxY = this.doorGridPos.row * GRID_SIZE + (GRID_SIZE/2);
    
    // Zona de elevador sin pared frontal
    const elevatorRect = this.add.rectangle(pxX, pxY, GRID_SIZE*2, GRID_SIZE, 0x10b981, 0.2);
    elevatorRect.setStrokeStyle(2, 0x10b981);
    
    this.add.text(pxX, pxY, 'ELEVADOR', {
      fontSize: '10px', fill: '#10b981', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  // ==========================================
  // Utils
  // ==========================================
  gridToPx(col, row) {
    return {
      x: col * GRID_SIZE + (GRID_SIZE / 2),
      y: row * GRID_SIZE + (GRID_SIZE / 2)
    };
  }
  
  pxToGrid(pxX, pxY) {
    return {
      col: Math.floor(pxX / GRID_SIZE),
      row: Math.floor(pxY / GRID_SIZE)
    };
  }

  handleTelemetryEvent(event, isJumpReplay = false) {
    const { agentId, agentRole, state, timestamp } = event;
    if (!agentId) return;
    
    let eventTime = null;
    if (timestamp) {
      eventTime = new Date(timestamp).getTime();
      // Solo actualizamos el tiempo global si no es un replay de salto,
      // ya que en un salto el tiempo global se establece explícitamente y 
      // los eventos pasados no deben retroceder el reloj.
      if (!isJumpReplay) {
        this.currentSimTime = eventTime;
      }
    }

    let avatar = this.agents.get(agentId);

    if (!avatar) {
      const startPx = this.gridToPx(this.doorGridPos.col, this.doorGridPos.row);
      avatar = new Avatar(this, startPx.x, startPx.y, agentId, agentRole);
      avatar.lastSimActivity = eventTime || this.currentSimTime || Date.now();
      this.agents.set(agentId, avatar);
    }

    if (avatar && avatar.active) {
      avatar.handleTelemetryState(state, eventTime || this.currentSimTime);
    }
    
    if (!isJumpReplay) {
      this.checkInactivityLifecycle();
    }
  }

  checkInactivityLifecycle() {
    if (!this.currentSimTime) return;
    
    const REST_THRESHOLD = 30000; // 30 segundos sin logs = descansar
    const DESPAWN_THRESHOLD = 120000; // 2 minutos sin logs = irse
    
    for (const [id, avatar] of this.agents.entries()) {
      // El Team Leader (orquestador) siempre está activo, nunca descansa ni hace despawn
      if (avatar.agentRole === 'team_leader') continue;

      const inactiveTime = this.currentSimTime - avatar.lastSimActivity;
      
      if (inactiveTime > DESPAWN_THRESHOLD) {
        if (!avatar.isDespawning) {
          avatar.isDespawning = true;
          const doorPx = this.gridToPx(this.doorGridPos.col, this.doorGridPos.row);
          avatar.despawn(doorPx, () => {
            this.agents.delete(id);
          });
        }
      } else if (inactiveTime > REST_THRESHOLD) {
        if (!avatar.isDespawning && avatar.fsm.state !== 'RESTING') {
          // Forzar descanso
          avatar.handleTelemetryState('RESTING', avatar.lastSimActivity);
        }
      }
    }
  }

  resetOffice() {
    this.agents.forEach(a => a.destroy(true));
    this.agents.clear();
  }
}
