import Phaser from 'phaser';
import * as EasyStar from 'easystarjs';
import { generateProceduralTextures } from './assets.js';
import { Avatar } from './Avatar.js';
import { gameEvents, EVENTS } from './eventBus.js';

window.levelData = null; // Se inicializa en create()

import deskImg from '../assets/desk.png';
import deskTlImg from '../assets/desk_tl.png';
import sofaImg from '../assets/sofa.png';
import desk4Img from '../assets/desk_4.png';
import coffeeBarImg from '../assets/coffee_bar.png';
import barStoolImg from '../assets/bar_stool.png';
import sofaRectoImg from '../assets/sofa_recto.png';
import sofaSingleImg from '../assets/sofa_single.png';
import tvWallImg from '../assets/tv_wall.png';
import plant1Img from '../assets/plant_1.png';
import plant2Img from '../assets/plant_2.png';
import plant3Img from '../assets/plant_3.png';
import printerImg from '../assets/printer.png';
import waterImg from '../assets/water.png';
import waterCoolerImg from '../assets/water_cooler.png';
import cristalWallImg from '../assets/cristal_wall.png';

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
    // Load dynamically to avoid Vite module caching on refresh
    this.load.json('defaultLayout', '/src/game/defaultLayout.json?t=' + Date.now());

    this.load.image('prop_desk', deskImg);
    this.load.image('prop_desk_tl', deskTlImg);
    this.load.image('prop_sofa', sofaImg);
    this.load.image('prop_desk_4', desk4Img);
    this.load.image('prop_coffee_bar', coffeeBarImg);
    this.load.image('prop_bar_stool', barStoolImg);
    this.load.image('prop_sofa_recto', sofaRectoImg);
    this.load.image('prop_sofa_single', sofaSingleImg);
    this.load.image('prop_tv_wall', tvWallImg);
    this.load.image('prop_plant_1', plant1Img);
    this.load.image('prop_plant_2', plant2Img);
    this.load.image('prop_plant_3', plant3Img);
    this.load.image('prop_printer', printerImg);
    this.load.image('prop_water', waterImg);
    this.load.image('prop_water_cooler', waterCoolerImg);
    this.load.image('prop_cristal_wall', cristalWallImg);
  }

  create() {
    this.mode = 'PLAY'; // Modos: PLAY, EDIT_LAYOUT, EDIT_COLLISION, EDIT_NODES
    window.levelData = this.cache.json.get('defaultLayout');
    
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

    // Controles de Cámara para Modo Editor
    this.editorKeys = this.input.keyboard.addKeys('W,A,S,D');
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Controles de Edición de Props
    this.input.keyboard.on('keydown-R', () => {
      if (this.mode === 'EDIT_LAYOUT' && this.hoveredProp) {
        this.hoveredProp.angle += 90;
        const data = window.levelData.props.find(p => p.id === this.hoveredProp.getData('propId'));
        if (data) {
          data.rotation = this.hoveredProp.angle;
          this.saveState();
        }
      }
    });

    this.input.keyboard.on('keydown-E', () => {
      if (this.mode === 'EDIT_LAYOUT' && this.hoveredProp) {
        this.hoveredProp.setDisplaySize(this.hoveredProp.displayWidth * 1.1, this.hoveredProp.displayHeight * 1.1);
        const data = window.levelData.props.find(p => p.id === this.hoveredProp.getData('propId'));
        if (data) {
          data.width = this.hoveredProp.displayWidth;
          data.height = this.hoveredProp.displayHeight;
          this.saveState();
        }
      }
    });

    this.input.keyboard.on('keydown-Q', () => {
      if (this.mode === 'EDIT_LAYOUT' && this.hoveredProp) {
        this.hoveredProp.setDisplaySize(this.hoveredProp.displayWidth * 0.9, this.hoveredProp.displayHeight * 0.9);
        const data = window.levelData.props.find(p => p.id === this.hoveredProp.getData('propId'));
        if (data) {
          data.width = this.hoveredProp.displayWidth;
          data.height = this.hoveredProp.displayHeight;
          this.saveState();
        }
      }
    });

    // Deshabilitar menú contextual del clic derecho para poder usarlo para arrastrar cámara
    this.input.mouse.disableContextMenu();

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      if (this.mode !== 'PLAY') {
        const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom + zoomDelta, 0.5, 2.0);
        this.cameras.main.setZoom(newZoom);
      }
    });

    // === HERRAMIENTAS MODO EDITOR ===
    // 1. Grid superpuesto (visible solo en modos editor)
    this.editorGrid = this.add.grid(0, 0, COLS * GRID_SIZE * 2, ROWS * GRID_SIZE * 2, GRID_SIZE, GRID_SIZE, 0x000000, 0, 0xffffff, 0.2).setOrigin(0,0).setDepth(9998).setVisible(false);
    
    // 2. Sprite Fantasma para previsualizar colocación
    this.ghostSprite = this.add.image(0, 0, '').setOrigin(0, 0).setAlpha(0.5).setDepth(9999).setVisible(false);

    // Escuchar selección de pincel de nodos
    this.activeNodeBrush = null;
    window.addEventListener('set-node-brush', (e) => {
      this.activeNodeBrush = e.detail.type;
      if (!this.activeNodeBrush && this.ghostNode) {
        this.ghostNode.setVisible(false);
      }
    });

    // Escuchar cambios de modo desde React
    window.addEventListener('set-editor-mode', (e) => {
      this.mode = e.detail.mode;
      if (this.mode === 'PLAY') {
        this.cameras.main.setZoom(1);
        this.cameras.main.setScroll(0, 0);
        this.editorGrid.setVisible(false);
        this.ghostSprite.setVisible(false);
        if (this.ghostNode) this.ghostNode.setVisible(false);
      } else {
        this.editorGrid.setVisible(true);
      }
    });

    // 3. Eventos Drag & Drop de HTML5
    const canvas = this.sys.game.canvas;
    
    canvas.addEventListener('dragover', (e) => {
      if (!window.currentDragItem) return;
      if (this.mode !== 'EDIT_LAYOUT') return; // Nodos ya no usan HTML5 drag
      e.preventDefault(); // Necesario para permitir el 'drop'
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const worldPoint = this.cameras.main.getWorldPoint(x, y);
      
      let snappedX = worldPoint.x;
      let snappedY = worldPoint.y;
      
      if (!e.altKey) {
        snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
        snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
      }
      
      const propData = window.currentDragItem;
      
      this.ghostSprite.setTexture(propData.id);
      this.ghostSprite.setDisplaySize(propData.width, propData.height);
      
      if (propData.id === 'prop_bar_stool') {
        this.ghostSprite.setOrigin(0.5, 0.5);
        this.ghostSprite.setPosition(snappedX + GRID_SIZE/2, snappedY + GRID_SIZE/2);
      } else {
        this.ghostSprite.setOrigin(0, 0);
        this.ghostSprite.setPosition(snappedX, snappedY);
      }
      
      this.ghostSprite.setVisible(true);
    });

    canvas.addEventListener('dragleave', () => {
      this.ghostSprite.setVisible(false);
    });

    canvas.addEventListener('drop', (e) => {
      if (!window.currentDragItem) return;
      if (this.mode !== 'EDIT_LAYOUT') return;
      e.preventDefault();
      this.ghostSprite.setVisible(false);
      
      const propData = window.currentDragItem;
      const newX = this.ghostSprite.x;
      const newY = this.ghostSprite.y;
      
      this.placeNewProp(propData.id, newX, newY, propData.width, propData.height);
    });

    // 4. MODO COLISIONES (Capa Pintable) Y MODO NODOS (Pincel)
    this.collisionOverlay = this.add.graphics().setDepth(9997).setVisible(false);
    this.isDraggingObject = false;
    this.isPaintingNodes = false;
    
    this.input.on('pointerdown', (pointer) => {
      if (this.mode === 'EDIT_COLLISION' && pointer.button === 0) { // Clic Izquierdo
        this.isPaintingCollisions = true;
        this.paintCollision(pointer);
      } else if (this.mode === 'EDIT_NODES' && pointer.button === 0 && this.activeNodeBrush && !pointer.event.shiftKey) {
        this.isPaintingNodes = true;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
        this.placeNewNode(this.activeNodeBrush, snappedX, snappedY);
      }
    });

    // Modificamos el pointermove existente para incluir el pintado y paneo general
    this.input.on('pointermove', (pointer) => {
      // Paneo con clic (Izquierdo, Central o Derecho) - siempre que no estemos pintando ni arrastrando un objeto
      const isPaintingCollision = this.mode === 'EDIT_COLLISION' && this.isPaintingCollisions && pointer.button === 0;
      const isPaintingNode = this.mode === 'EDIT_NODES' && this.isPaintingNodes && pointer.button === 0;
      
      if (pointer.isDown && !isPaintingCollision && !isPaintingNode && !this.isDraggingObject) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
      
      // Pintado de Colisiones (Arrastrar Clic Izquierdo)
      if (isPaintingCollision) {
        this.paintCollision(pointer);
      }

      // Pintado de Nodos (Arrastrar Clic Izquierdo)
      if (isPaintingNode) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
        this.placeNewNode(this.activeNodeBrush, snappedX, snappedY);
      }

      // Pincel Ghost para Nodos
      if (this.mode === 'EDIT_NODES' && this.activeNodeBrush) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
        
        if (!this.ghostNode) {
          this.ghostNode = this.add.graphics().setDepth(9999);
        }
        this.ghostNode.clear();
        this.ghostNode.setPosition(snappedX + GRID_SIZE/2, snappedY + GRID_SIZE/2);
        if (this.activeNodeBrush === 'node_work') this.ghostNode.fillStyle(0x10b981, 0.5);
        else this.ghostNode.fillStyle(0x3b82f6, 0.5);
        this.ghostNode.fillCircle(0, 0, 12);
        this.ghostNode.setVisible(true);
      } else if (this.ghostNode) {
        this.ghostNode.setVisible(false);
      }
    });

    this.input.on('pointerup', () => {
      if (this.isPaintingCollisions) {
        this.saveState();
      }
      this.isPaintingCollisions = false;
      this.isPaintingNodes = false;
    });

    // 5. MODO POSICIONES (Nodos de Interacción)
    this.nodeSprites = [];

    // Refinar el cambio de modo para los overlays
    window.addEventListener('set-editor-mode', (e) => {
      this.mode = e.detail.mode;
      this.ghostSprite.setVisible(false);
      this.editorGrid.setVisible(this.mode !== 'PLAY');
      
      if (this.mode === 'EDIT_COLLISION') {
        this.collisionOverlay.setVisible(true);
        this.setNodeSpritesVisible(false);
        this.cameras.main.setAlpha(0.8);
        this.drawCollisionOverlay();
      } else if (this.mode === 'EDIT_NODES') {
        this.collisionOverlay.setVisible(false);
        this.setNodeSpritesVisible(true);
        this.cameras.main.setAlpha(0.6);
        this.drawNodesOverlay();
      } else {
        this.collisionOverlay.setVisible(false);
        this.setNodeSpritesVisible(false);
        this.cameras.main.setAlpha(1.0);
      }
      
      if (this.mode === 'PLAY') {
        this.cameras.main.setZoom(1);
        this.cameras.main.setScroll(0, 0);
      }
    });

    // --- Sistema de History para Undo/Redo ---
    this.history = [];
    this.historyIndex = -1;
    this.saveState(); // Estado inicial

    window.addEventListener('editor-action', (e) => {
      const { action, payload } = e.detail;
      if (action === 'ZOOM') {
        this.cameras.main.setZoom(payload);
      } else if (action === 'UNDO') {
        this.undo();
      } else if (action === 'REDO') {
        this.redo();
      } else if (action === 'SAVE') {
        this.downloadJSON();
      } else if (action === 'RELOAD') {
        window.location.reload();
      }
    });

    console.log('[Phaser] Blockout estructural (Greybox) renderizado.');
  }

  // ==========================================
  // Undo/Redo & Save
  // ==========================================
  saveState() {
    // Asegurarnos de que el mapa de colisiones actual está en el objeto
    if (this.navGrid) {
      window.levelData.collisionMap = this.navGrid;
    }
    
    // Clon profundo del estado actual
    const stateStr = JSON.stringify(window.levelData);
    
    // Si no estamos en la punta del historial, truncamos lo de adelante
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    this.history.push(stateStr);
    this.historyIndex++;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState(this.history[this.historyIndex]);
    }
  }

  restoreState(stateStr) {
    window.levelData = JSON.parse(stateStr);
    // Redibujar todo según el modo activo
    this.drawGreyboxLayout(); // Esto redibuja los props
    if (this.mode === 'EDIT_NODES') this.drawNodesOverlay();
    if (this.mode === 'EDIT_COLLISION') {
      this.navGrid = window.levelData.collisionMap && window.levelData.collisionMap.length > 0 
                     ? window.levelData.collisionMap 
                     : this.navGrid; // Asumimos que collisionMap se guarda o usamos el base
      this.drawCollisionOverlay();
    }
  }

  downloadJSON() {
    // Preparar guardado de collisionMap si es necesario
    window.levelData.collisionMap = this.navGrid;
    
    // Guardar en el disco a través de nuestro endpoint custom de Vite
    fetch('/api/save-layout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(window.levelData, null, 2)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log('[Editor] Layout guardado exitosamente en el disco (defaultLayout.json).');
        // Visual feedback opcional
        const event = new CustomEvent('editor-action', { detail: { action: 'SAVE_SUCCESS' } });
        window.dispatchEvent(event);
      } else {
        console.error('[Editor] Error al guardar el layout:', data.error);
      }
    })
    .catch(err => console.error('[Editor] Error de red al guardar:', err));
  }

  // ==========================================
  // Pintado de Nodos
  // ==========================================
  placeNewNode(nodeType, x, y) {
    const col = Math.floor(x / GRID_SIZE);
    const row = Math.floor(y / GRID_SIZE);
    
    // Evitar duplicados exactos
    const exists = window.levelData.interactionNodes.find(n => n.col === col && n.row === row);
    if (!exists) {
      const newNode = {
        id: 'node_' + Date.now(),
        type: nodeType,
        col: col,
        row: row
      };
      window.levelData.interactionNodes.push(newNode);
      console.log(`[Editor] Nodo ${nodeType} añadido en col:${col}, row:${row}`);
      
      // En vez de redibujar todo, solo añadimos el sprite del nuevo nodo
      this.createNodeSprite(newNode);
      this.saveState();
    }
  }

  setNodeSpritesVisible(visible) {
    if (this.nodeSprites) {
      this.nodeSprites.forEach(sprite => sprite.setVisible(visible));
    }
  }

  createNodeSprite(node) {
    const pxX = node.col * GRID_SIZE + GRID_SIZE / 2;
    const pxY = node.row * GRID_SIZE + GRID_SIZE / 2;
    
    const color = node.type === 'node_work' ? 0x10b981 : (node.type === 'node_lounge' ? 0x3b82f6 : 0xffffff);
    const circle = this.add.circle(pxX, pxY, 12, color, 0.8);
    circle.setStrokeStyle(2, 0xffffff, 1);
    circle.setDepth(9996);
    circle.setVisible(this.mode === 'EDIT_NODES');
    
    circle.setInteractive({ 
      hitArea: new Phaser.Geom.Circle(12, 12, 16),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
      draggable: true 
    });

    circle.on('dragstart', () => {
      if (this.mode === 'EDIT_NODES') this.isDraggingObject = true;
    });
    
    circle.on('drag', (pointer, dragX, dragY) => {
      if (this.mode !== 'EDIT_NODES') return;
      const snappedX = Math.floor(dragX / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
      const snappedY = Math.floor(dragY / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
      circle.setPosition(snappedX, snappedY);
    });
    
    circle.on('dragend', () => {
      this.isDraggingObject = false;
      if (this.mode !== 'EDIT_NODES') return;
      const newCol = Math.floor(circle.x / GRID_SIZE);
      const newRow = Math.floor(circle.y / GRID_SIZE);
      if (node.col !== newCol || node.row !== newRow) {
        node.col = newCol;
        node.row = newRow;
        this.saveState();
      }
    });
    
    circle.on('pointerdown', (pointer) => {
      if (this.mode === 'EDIT_NODES' && pointer.event.shiftKey) {
        window.levelData.interactionNodes = window.levelData.interactionNodes.filter(n => n !== node);
        circle.destroy();
        this.nodeSprites = this.nodeSprites.filter(s => s !== circle);
        this.saveState();
      }
    });
    
    this.nodeSprites.push(circle);
    return circle;
  }

  drawNodesOverlay() {
    // Limpiar sprites anteriores
    if (this.nodeSprites) {
      this.nodeSprites.forEach(sprite => sprite.destroy());
    }
    this.nodeSprites = [];

    if (!window.levelData || !window.levelData.interactionNodes) return;

    window.levelData.interactionNodes.forEach((node) => {
      this.createNodeSprite(node);
    });
  }

  // ==========================================
  // Pintado de Colisiones
  // ==========================================
  paintCollision(pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(worldPoint.x / GRID_SIZE);
    const row = Math.floor(worldPoint.y / GRID_SIZE);

    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      // Si presionamos Shift, borramos (0). Si no, pintamos obstáculo (1).
      const isErasing = pointer.event.shiftKey;
      const newValue = isErasing ? 0 : 1;
      
      if (this.navGrid[row][col] !== newValue) {
        this.navGrid[row][col] = newValue;
        this.drawCollisionOverlay();
        // Actualizar Pathfinding en tiempo real
        this.finder.setGrid(this.navGrid);
      }
    }
  }

  drawCollisionOverlay() {
    this.collisionOverlay.clear();
    if (!this.navGrid) return;
    
    this.collisionOverlay.fillStyle(0xff0000, 0.4); // Rojo semitransparente
    this.collisionOverlay.lineStyle(1, 0xff0000, 0.8);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.navGrid[r][c] === 1) {
          const px = c * GRID_SIZE;
          const py = r * GRID_SIZE;
          this.collisionOverlay.fillRect(px, py, GRID_SIZE, GRID_SIZE);
          this.collisionOverlay.strokeRect(px, py, GRID_SIZE, GRID_SIZE);
        }
      }
    }
  }

  update() {
    // Procesar cola de pathfinding (EasyStar no bloquea el hilo principal)
    this.finder.calculate();
    
    // Actualizar agentes
    this.agents.forEach(a => a.update());

    // Movimiento libre de cámara en modo editor
    if (this.mode !== 'PLAY') {
      const camSpeed = 10 / this.cameras.main.zoom;
      if (this.editorKeys.W.isDown || this.cursors.up.isDown) this.cameras.main.scrollY -= camSpeed;
      if (this.editorKeys.S.isDown || this.cursors.down.isDown) this.cameras.main.scrollY += camSpeed;
      if (this.editorKeys.A.isDown || this.cursors.left.isDown) this.cameras.main.scrollX -= camSpeed;
      if (this.editorKeys.D.isDown || this.cursors.right.isDown) this.cameras.main.scrollX += camSpeed;
    }
  }

  // ==========================================
  // Pathfinding (NavGrid)
  // ==========================================
  setupPathfinding() {
    // Si ya existe un mapa de colisiones guardado y es válido, lo usamos
    if (window.levelData.collisionMap && window.levelData.collisionMap.length === ROWS) {
      this.navGrid = JSON.parse(JSON.stringify(window.levelData.collisionMap));
    } else {
      // Generación inicial si no existe
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

      // Obstáculos base predeterminados si no había JSON
      addObstacle(1, 1, 4, 2);
      addObstacle(1, 3, 1, 2);
      addObstacle(18, 0, 1, 6);
      addObstacle(18, 9, 1, 7);

      const islandPositions = [
        { col: 7, row: 3 }, { col: 13, row: 3 },
        { col: 7, row: 10 }, { col: 13, row: 10 }
      ];
      islandPositions.forEach(pos => {
        addObstacle(pos.col, pos.row, 3, 2);
      });

      addObstacle(23, 1, 4, 1);
      addObstacle(21, 4, 4, 1);
      addObstacle(24, 5, 1, 2);
      addObstacle(21, 8, 3, 1);
      addObstacle(25, 7, 1, 1);
      addObstacle(26, 9, 1, 1);
      addObstacle(21, 6, 1, 1);
      addObstacle(23, 6, 1, 1);
      addObstacle(24, 9, 1, 1);
      addObstacle(26, 13, 1, 3);
      addObstacle(22, 13, 2, 2);
      
      // Guardarlo por defecto
      window.levelData.collisionMap = JSON.parse(JSON.stringify(this.navGrid));
    }

    // Configurar EasyStar
    this.finder.setGrid(this.navGrid);
    this.finder.setAcceptableTiles([0]);
    this.finder.enableDiagonals();
    this.finder.disableCornerCutting();
  }

  getRandomDesk(role) {
    const workNodes = (window.levelData.interactionNodes || []).filter(n => n.type === 'node_work');
    
    // Fallback if no nodes are placed
    if (workNodes.length === 0) {
      if (role === 'team_leader') return { col: 2, row: 3 };
      return { col: 7, row: 2 }; 
    }

    if (role === 'team_leader') {
      // El TL busca el nodo más arriba a la izquierda (col < 6)
      const tlDesk = workNodes.find(n => n.col < 6 && n.row < 6);
      if (tlDesk) return tlDesk;
      // Si no hay, usa el primero disponible
    }

    const occupied = new Set();
    this.agents.forEach(a => {
      if (a.assignedDesk) occupied.add(`${a.assignedDesk.col},${a.assignedDesk.row}`);
    });

    const freeDesks = workNodes.filter(d => !occupied.has(`${d.col},${d.row}`));
    if (freeDesks.length === 0) return workNodes[Math.floor(Math.random() * workNodes.length)];
    return freeDesks[Math.floor(Math.random() * freeDesks.length)];
  }

  getRandomLoungeSpot() {
    const loungeNodes = (window.levelData.interactionNodes || []).filter(n => n.type === 'node_lounge');
    
    // Fallback if no nodes are placed
    if (loungeNodes.length === 0) {
      return { col: 23, row: 2 };
    }

    const occupied = new Set();
    this.agents.forEach(a => {
      if (a.assignedLounge) occupied.add(`${a.assignedLounge.col},${a.assignedLounge.row}`);
    });

    const freeSpots = loungeNodes.filter(s => !occupied.has(`${s.col},${s.row}`));
    if (freeSpots.length === 0) return loungeNodes[Math.floor(Math.random() * loungeNodes.length)];
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
  }

  // ==========================================
  // Layout Estructural (Blockout Visual y Datos)
  // ==========================================
  drawGreyboxLayout() {
    if (this.layoutGraphics) {
      this.layoutGraphics.destroy();
    }
    if (this.shadowsGroup) {
      this.shadowsGroup.clear(true, true);
    } else {
      this.shadowsGroup = this.add.group();
    }
    
    this.layoutGraphics = this.add.graphics();

    // Sombra del Muro Divisorio Central
    this.layoutGraphics.fillStyle(0x000000, 0.5);
    this.layoutGraphics.fillRect(18 * GRID_SIZE + 6, 6, 1 * GRID_SIZE, 6 * GRID_SIZE);
    this.layoutGraphics.fillRect(18 * GRID_SIZE + 6, 9 * GRID_SIZE + 6, 1 * GRID_SIZE, 7 * GRID_SIZE);

    // --- A. Oficina del Team Leader (Arriba Izquierda) ---
    // Suelo tintado
    this.layoutGraphics.fillStyle(0x0284c7, 0.08); 
    this.layoutGraphics.fillRect(0, 0, 6 * GRID_SIZE, 7 * GRID_SIZE);
    
    // Paredes de "vidrio" simuladas con borde brillante cian
    this.layoutGraphics.lineStyle(2, 0x22d3ee, 0.5); 
    this.layoutGraphics.strokeRect(0, 0, 6 * GRID_SIZE, 7 * GRID_SIZE);
    
    // Mesa visitas TL
    this.layoutGraphics.fillStyle(0x334155, 1);
    this.layoutGraphics.fillCircle(4.5 * GRID_SIZE, 5 * GRID_SIZE, 12);

    // --- B. Muro Divisorio Central-Derecho ---
    this.layoutGraphics.fillStyle(0x0f172a, 1); // Color slate muro oscuro
    this.layoutGraphics.fillRect(18 * GRID_SIZE, 0, 1 * GRID_SIZE, 6 * GRID_SIZE);
    this.layoutGraphics.fillRect(18 * GRID_SIZE, 9 * GRID_SIZE, 1 * GRID_SIZE, 7 * GRID_SIZE);

    // Sombras proyectadas para las islas de trabajo
    const islandPositions = [
      { col: 7, row: 3 },  { col: 13, row: 3 },
      { col: 7, row: 10 }, { col: 13, row: 10 }
    ];
    islandPositions.forEach(pos => {
      const pxX = pos.col * GRID_SIZE;
      const pxY = pos.row * GRID_SIZE;
      const deskShadow = this.add.graphics();
      deskShadow.fillStyle(0x000000, 0.35);
      deskShadow.fillRoundedRect(pxX + 2, pxY + 2, 3.2 * GRID_SIZE, 2.4 * GRID_SIZE, 6);
      this.shadowsGroup.add(deskShadow);
    });

    // Sombra suave para el Sofá U
    const sofaShadow = this.add.graphics();
    sofaShadow.fillStyle(0x000000, 0.35);
    sofaShadow.fillRoundedRect(21 * GRID_SIZE + 4, 4.2 * GRID_SIZE + 4, 4.5 * GRID_SIZE, 3 * GRID_SIZE, 8);
    this.shadowsGroup.add(sofaShadow);

    // Mesita de centro para las butacas
    this.layoutGraphics.fillStyle(0x334155, 1); 
    this.layoutGraphics.fillCircle(24.2 * GRID_SIZE, 9.2 * GRID_SIZE, 10);
    
    // Glow de la TV
    const tvGlow = this.add.graphics();
    tvGlow.fillStyle(0x38bdf8, 0.2);
    tvGlow.fillCircle(24.5 * GRID_SIZE, 13 * GRID_SIZE, 50);
    tvGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.shadowsGroup.add(tvGlow);

    // ---------------------------------------------------------
    // Instanciar Props desde defaultLayout.json
    // ---------------------------------------------------------
    // Limpiar props anteriores si los hay
    if (this.propSprites) {
      this.propSprites.forEach(s => s.destroy());
    }
    this.propSprites = [];
    
    window.levelData.props.forEach(propData => {
      this.createPropSprite(propData);
    });
  }

  createPropSprite(propData) {
    const sprite = this.add.image(propData.x, propData.y, propData.type);
    
    if (propData.type === 'prop_bar_stool') {
      sprite.setOrigin(0.5, 0.5);
    } else {
      sprite.setOrigin(0, 0);
    }
    
    sprite.setDisplaySize(propData.width, propData.height);
    sprite.angle = propData.rotation || 0;
    sprite.setDepth(propData.y);
    sprite.setData('propId', propData.id);
    sprite.setData('propType', propData.type);
    
    // Hacer prop interactivo en modo EDIT_LAYOUT
    sprite.setInteractive({ useHandCursor: true, draggable: true });
    
    sprite.on('dragstart', () => {
      if (this.mode === 'EDIT_LAYOUT') this.isDraggingObject = true;
    });

    sprite.on('drag', (pointer, dragX, dragY) => {
      if (this.mode !== 'EDIT_LAYOUT') return;
      let snappedX = dragX;
      let snappedY = dragY;
      if (!pointer.event.altKey) {
        snappedX = Math.floor(dragX / GRID_SIZE) * GRID_SIZE;
        snappedY = Math.floor(dragY / GRID_SIZE) * GRID_SIZE;
        if (propData.type === 'prop_bar_stool') {
          snappedX += GRID_SIZE / 2;
          snappedY += GRID_SIZE / 2;
        }
      }
      sprite.setPosition(snappedX, snappedY);
      sprite.setDepth(snappedY); // Actualizar Y-Sorting
    });
    
    sprite.on('dragend', () => {
      this.isDraggingObject = false;
      if (this.mode !== 'EDIT_LAYOUT') return;
      if (propData.x !== sprite.x || propData.y !== sprite.y) {
        propData.x = sprite.x;
        propData.y = sprite.y;
        this.saveState();
      }
    });
    
    sprite.on('pointerdown', (pointer) => {
      if (this.mode === 'EDIT_LAYOUT' && pointer.event.shiftKey) {
        window.levelData.props = window.levelData.props.filter(p => p.id !== propData.id);
        sprite.destroy();
        this.propSprites = this.propSprites.filter(s => s !== sprite);
        this.saveState();
      }
    });

    sprite.on('pointerover', () => {
      if (this.mode === 'EDIT_LAYOUT') this.hoveredProp = sprite;
    });

    sprite.on('pointerout', () => {
      if (this.hoveredProp === sprite) this.hoveredProp = null;
    });
    
    this.propSprites.push(sprite);
    return sprite;
  }

  createElevator() {
    const pxX = this.doorGridPos.col * GRID_SIZE + (GRID_SIZE/2);
    const pxY = this.doorGridPos.row * GRID_SIZE + (GRID_SIZE/2);
    
    // Zona de elevador sin pared frontal
    const elevatorRect = this.add.rectangle(pxX, pxY, GRID_SIZE*2, GRID_SIZE, 0x10b981, 0.2);
    elevatorRect.setStrokeStyle(2, 0x10b981);
    // Para asegurar que el elevador quede en el piso
    elevatorRect.setDepth(0);
    
    this.add.text(pxX, pxY, 'ELEVADOR', {
      fontSize: '10px', fill: '#10b981', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1);
  }

  // ==========================================
  // Herramientas del Modo Editor
  // ==========================================
  placeNewProp(propType, x, y, width, height) {
    const newId = 'prop_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    const propData = {
      id: newId,
      type: propType,
      x: x,
      y: y,
      width: width,
      height: height,
      rotation: 0
    };
    
    window.levelData.props.push(propData);
    this.createPropSprite(propData);
    
    this.saveState();
    console.log(`[Editor] Colocado nuevo prop: ${propType} en (${x}, ${y})`);
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
    
    const REST_THRESHOLD = 120000; // 2 minutos sin logs = descansar (ej. esperando respuesta larga)
    const DESPAWN_THRESHOLD = 600000; // 10 minutos sin logs = irse de la oficina
    
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
