import Phaser from 'phaser';
import * as EasyStar from 'easystarjs';
import { generateProceduralTextures } from './assets.js';
import { Avatar } from './Avatar.js';
import { gameEvents, EVENTS } from './eventBus.js';
import { mapRawRoleToKey } from './agentMapper.js';

window.levelData = null; // Se inicializa en create()

const rootAssetFiles = import.meta.glob('../assets/*.png', { eager: true, import: 'default' });
const objetoFiles = import.meta.glob('../assets/objetos/*.png', { eager: true, import: 'default' });
const estructuraFiles = import.meta.glob('../assets/estructura/*.png', { eager: true, import: 'default' });
const backgroundFiles = import.meta.glob('../assets/backgrounds/*.png', { eager: true, import: 'default' });
const propFiles = { ...rootAssetFiles, ...objetoFiles, ...estructuraFiles, ...backgroundFiles };
const structureKeys = new Set(
  Object.keys(estructuraFiles).map(p => `prop_${p.split('/').pop().replace('.png', '')}`)
);

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

    Object.keys(propFiles).forEach(path => {
      const filename = path.split('/').pop().replace('.png', '');
      this.load.image(`prop_${filename}`, propFiles[path]);
    });

    // Cargar spritesheets de avatares
    this.load.spritesheet('avatar_jefe', '/src/assets/avatares/jefe_sprite.png', {
      frameWidth: Math.floor(2150 / 4), // 537
      frameHeight: Math.floor(1523 / 2) // 761
    });

    this.load.spritesheet('avatar_designer', '/src/assets/avatares/diseñadora_sprite.png', {
      frameWidth: Math.floor(2752 / 4), // 688
      frameHeight: Math.floor(1536 / 2) // 768
    });

    const standardSpriteConfig = {
      frameWidth: Math.floor(2752 / 4),
      frameHeight: Math.floor(1536 / 2)
    };
    
    this.load.spritesheet('avatar_dba', '/src/assets/avatares/dba_sprite.png', standardSpriteConfig);
    this.load.spritesheet('avatar_developer', '/src/assets/avatares/developer_sprite.png', standardSpriteConfig);
    this.load.spritesheet('avatar_qa', '/src/assets/avatares/qa_sprite.png', standardSpriteConfig);
    this.load.spritesheet('avatar_security', '/src/assets/avatares/security_sprite.png', standardSpriteConfig);
    this.load.spritesheet('avatar_documenter', '/src/assets/avatares/document_sprite.png', standardSpriteConfig);

    // Variaciones especiales de escritorio trabajando (sin piernas / en escritorio con teclado)
    this.load.spritesheet('avatares_working', '/src/assets/avatares/avatares_working_sprite.png', {
      frameWidth: 688,
      frameHeight: 768
    });
  }

  create() {
    this.mode = 'PLAY'; // Modos: PLAY, EDIT_LAYOUT, EDIT_COLLISION, EDIT_NODES
    window.levelData = this.cache.json.get('defaultLayout');
    
    // Ajustar la cámara para mostrar el área completa de paredes (X = -32, Y = -64)
    this.cameras.main.setScroll(-32, -64);
    
    // Añadir paredes completas (fondo norte y laterales) superpuestas sobre el lienzo
    const initialTheme = localStorage.getItem('office_theme') === 'day';
    const initialKey = initialTheme ? 'prop_office_walls_day' : 'prop_office_walls';
    this.bgWalls = this.add.image(-32, -64, initialKey)
      .setOrigin(0, 0)
      .setDisplaySize(928, 576)
      .setDepth(-3);

    // Alternar entre fondo nocturno y de día
    window.addEventListener('toggle-day-night', (e) => {
      const isDay = e.detail.isDay;
      const textureKey = isDay ? 'prop_office_walls_day' : 'prop_office_walls';
      if (this.bgWalls && this.textures.exists(textureKey)) {
        this.bgWalls.setTexture(textureKey);
      }
      if (this.officeFloor) {
        this.officeFloor.setTexture(isDay ? 'floor_tile_day' : 'floor_tile');
      }
      if (this.loungeFloor) {
        this.loungeFloor.setTexture(isDay ? 'lounge_tile_day' : 'lounge_tile');
      }
    });

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

    this.events.on('AGENT_HOVER', (data) => {
      gameEvents.emit('AVATAR_HOVER', data);
    });

    this.events.on('AGENT_HOVER_OUT', (data) => {
      gameEvents.emit('AVATAR_HOVER_OUT', data);
    });

    this.scale.on('resize', () => {
      this._cachedCanvasRect = null;
    });

    // Controles de Cámara para Modo Editor
    this.editorKeys = this.input.keyboard.addKeys('W,A,S,D');
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Controles de Edición de Props
    this.input.keyboard.on('keydown-R', () => {
      if ((this.mode === 'EDIT_LAYOUT' || this.mode === 'EDIT_STRUCTURE') && this.hoveredProp) {
        this.hoveredProp.angle += 90;
        const data = window.levelData.props.find(p => p.id === this.hoveredProp.getData('propId'));
        if (data) {
          data.rotation = this.hoveredProp.angle;
          this.saveState();
        }
      } else if (this.mode === 'EDIT_STRUCTURE' && this.activeStructureBrush) {
        this.structureBrushRotation = ((this.structureBrushRotation || 0) + 90) % 360;
        if (this.ghostStructure) {
          this.ghostStructure.angle = this.structureBrushRotation;
        }
      } else if (this.mode === 'EDIT_NODES' && this.hoveredNodeData && this.hoveredNodeSprite) {
        // Rotar nodo
        const order = ['up', 'right', 'down', 'left'];
        let currentIdx = order.indexOf(this.hoveredNodeData.direction || 'up');
        let nextIdx = (currentIdx + 1) % 4;
        this.hoveredNodeData.direction = order[nextIdx];
        
        const dirs = { 'up': 0, 'right': Math.PI/2, 'down': Math.PI, 'left': -Math.PI/2 };
        this.hoveredNodeSprite.arrow.setRotation(dirs[this.hoveredNodeData.direction]);
        this.saveState();
      }
    });

    this.input.keyboard.on('keydown-E', () => {
      if ((this.mode === 'EDIT_LAYOUT' || this.mode === 'EDIT_STRUCTURE') && this.hoveredProp) {
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
      if ((this.mode === 'EDIT_LAYOUT' || this.mode === 'EDIT_STRUCTURE') && this.hoveredProp) {
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
        this.cameras.main.setScroll(-32, -64);
        this.editorGrid.setVisible(false);
        this.ghostSprite.setVisible(false);
        if (this.ghostNode) this.ghostNode.setVisible(false);
      } else {
        this.editorGrid.setVisible(true);
      }
    });

    // 3. Eventos Drag & Drop de HTML5 (Solo para EDIT_LAYOUT)
    const canvas = this.sys.game.canvas;
    
    canvas.addEventListener('dragover', (e) => {
      if (!window.currentDragItem) return;
      if (this.mode !== 'EDIT_LAYOUT') return;
      e.preventDefault();
      
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

      // Limpiar puntero de Phaser para que el drop de HTML5 no arrastre la cámara
      if (this.input.activePointer) {
        this.input.activePointer.isDown = false;
        this.input.activePointer.reset();
      }
    });

    // 4. MODO ESTRUCTURA (Pincel Piso/Paredes), COLISIONES Y NODOS
    this.collisionOverlay = this.add.graphics().setDepth(9997).setVisible(false);
    this.isDraggingObject = false;
    this.isPaintingCollisions = false;
    this.isPaintingNodes = false;
    this.isPaintingStructure = false;
    this.activeStructureBrush = null;
    this.structureBrushRotation = 0;

    // Sprite fantasma para pintar estructuras cuadrícula por cuadrícula (32x32)
    this.ghostStructure = this.add.image(0, 0, 'prop_floor_wood')
      .setOrigin(0, 0)
      .setDisplaySize(32, 32)
      .setDepth(9998)
      .setAlpha(0.65)
      .setVisible(false);

    window.addEventListener('set-structure-brush', (e) => {
      this.activeStructureBrush = e.detail.prop;
      this.structureBrushRotation = 0;
      if (!this.activeStructureBrush && this.ghostStructure) {
        this.ghostStructure.setVisible(false);
      }
    });
    
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
      } else if (this.mode === 'EDIT_STRUCTURE' && pointer.button === 0 && this.activeStructureBrush) {
        if (pointer.event.shiftKey) {
          this.eraseStructureAt(pointer);
        } else {
          this.isPaintingStructure = true;
          this.paintStructure(pointer);
        }
      }
    });

    this.input.on('pointermove', (pointer) => {
      const isPaintingCollision = this.mode === 'EDIT_COLLISION' && this.isPaintingCollisions && pointer.button === 0;
      const isPaintingNode = this.mode === 'EDIT_NODES' && this.isPaintingNodes && pointer.button === 0;
      const isPaintingStructure = this.mode === 'EDIT_STRUCTURE' && this.isPaintingStructure && pointer.button === 0;
      
      // Control de paneo de cámara:
      // En modos de edición NO se panea con clic izquierdo normal para evitar mover la escena al interactuar o pintar.
      // Se panea con: Botón Central, Botón Secundario, o manteniendo pulsada la barra espaciadora (o clic normal en PLAY).
      const isPanAllowed = (
        pointer.button === 1 || 
        pointer.button === 2 || 
        pointer.event.spaceKey || 
        (this.mode === 'PLAY' && pointer.button === 0)
      );

      if (pointer.isDown && isPanAllowed && !isPaintingCollision && !isPaintingNode && !isPaintingStructure && !this.isDraggingObject) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
      
      // Pintado de Colisiones
      if (isPaintingCollision) {
        this.paintCollision(pointer);
      }

      // Pintado de Nodos
      if (isPaintingNode) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
        this.placeNewNode(this.activeNodeBrush, snappedX, snappedY);
      }

      // Pintado continuo de Estructura (Clic sostenido de 32x32)
      if (this.mode === 'EDIT_STRUCTURE' && this.activeStructureBrush) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
        
        if (this.ghostStructure) {
          this.ghostStructure.setTexture(this.activeStructureBrush.id);
          this.ghostStructure.setDisplaySize(32, 32);
          this.ghostStructure.setPosition(snappedX, snappedY);
          this.ghostStructure.angle = this.structureBrushRotation || 0;
          this.ghostStructure.setVisible(true);
        }

        if (pointer.isDown && pointer.event.shiftKey) {
          this.eraseStructureAt(pointer);
        } else if (isPaintingStructure) {
          this.paintStructure(pointer);
        }
      } else if (this.ghostStructure) {
        this.ghostStructure.setVisible(false);
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
      if (this.isPaintingNodes) {
        this.saveState();
      }
      if (this.isPaintingStructure) {
        this.saveState();
      }
      this.isPaintingCollisions = false;
      this.isPaintingNodes = false;
      this.isPaintingStructure = false;
    });

    // 5. MODO POSICIONES (Nodos de Interacción)
    this.nodeSprites = [];

    // Refinar el cambio de modo para los overlays
    window.addEventListener('set-editor-mode', (e) => {
      this.mode = e.detail.mode;
      this.ghostSprite.setVisible(false);
      if (this.ghostStructure) this.ghostStructure.setVisible(false);
      if (this.mode !== 'EDIT_STRUCTURE') {
        this.activeStructureBrush = null;
      }
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
        this.cameras.main.setScroll(-32, -64);
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
        row: row,
        direction: 'up' // Por defecto miran hacia arriba
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
    
    // Asegurar dirección por defecto
    if (!node.direction) node.direction = 'up';

    const color = node.type === 'node_work' ? 0x10b981 : (node.type === 'node_lounge' ? 0x3b82f6 : 0xffffff);
    
    const container = this.add.container(pxX, pxY);
    container.setDepth(9996);
    container.setVisible(this.mode === 'EDIT_NODES');

    const circle = this.add.circle(0, 0, 12, color, 0.8);
    circle.setStrokeStyle(2, 0xffffff, 1);
    container.add(circle);

    // Flecha indicadora (Triángulo blanco)
    const arrow = this.add.triangle(0, -6, 0, -5, 5, 5, -5, 5, 0xffffff);
    container.add(arrow);
    container.arrow = arrow;

    const dirs = { 'up': 0, 'right': Math.PI/2, 'down': Math.PI, 'left': -Math.PI/2 };
    arrow.setRotation(dirs[node.direction]);

    container.setSize(24, 24);
    container.setInteractive({ 
      useHandCursor: true,
      draggable: true 
    });

    container.on('dragstart', () => {
      if (this.mode === 'EDIT_NODES') this.isDraggingObject = true;
    });
    
    container.on('drag', (pointer, dragX, dragY) => {
      if (this.mode !== 'EDIT_NODES') return;
      const snappedX = Math.floor(dragX / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
      const snappedY = Math.floor(dragY / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
      container.setPosition(snappedX, snappedY);
    });
    
    container.on('dragend', () => {
      this.isDraggingObject = false;
      if (this.mode !== 'EDIT_NODES') return;
      const newCol = Math.floor(container.x / GRID_SIZE);
      const newRow = Math.floor(container.y / GRID_SIZE);

      if (node.col !== newCol || node.row !== newRow) {
        node.col = newCol;
        node.row = newRow;
        this.saveState();
      }
    });

    container.on('pointerover', () => {
      this.hoveredNodeSprite = container;
      this.hoveredNodeData = node;
    });

    container.on('pointerout', () => {
      if (this.hoveredNodeSprite === container) {
        this.hoveredNodeSprite = null;
        this.hoveredNodeData = null;
      }
    });
    
    container.on('pointerdown', (pointer) => {
      if (this.mode === 'EDIT_NODES' && (pointer.event.shiftKey || pointer.rightButtonDown())) {
        window.levelData.interactionNodes = window.levelData.interactionNodes.filter(n => n !== node);
        container.destroy();
        this.nodeSprites = this.nodeSprites.filter(s => s !== container);
        if (this.hoveredNodeSprite === container) {
            this.hoveredNodeSprite = null;
            this.hoveredNodeData = null;
        }
        this.saveState();
      }
    });
    
    this.nodeSprites.push(container);
    return container;
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

    this.checkInactivityRealtime();

    // Movimiento libre de cámara
    const camSpeed = 10 / this.cameras.main.zoom;
    if (this.editorKeys.W.isDown || this.cursors.up.isDown) this.cameras.main.scrollY -= camSpeed;
    if (this.editorKeys.S.isDown || this.cursors.down.isDown) this.cameras.main.scrollY += camSpeed;
    if (this.editorKeys.A.isDown || this.cursors.left.isDown) this.cameras.main.scrollX -= camSpeed;
    if (this.editorKeys.D.isDown || this.cursors.right.isDown) this.cameras.main.scrollX += camSpeed;
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

      // Sin obstáculos por defecto, todo es caminable inicialmente
      // o se carga desde el JSON
      
      // Guardarlo por defecto
      window.levelData.collisionMap = JSON.parse(JSON.stringify(this.navGrid));
    }

    // Configurar EasyStar
    this.finder.setGrid(this.navGrid);
    this.finder.setAcceptableTiles([0]);
    this.finder.enableDiagonals();
    this.finder.disableCornerCutting();
  }

  getWalkableAdjacent(col, row) {
    // Si ya es caminable, retornar
    if (this.navGrid[row] && this.navGrid[row][col] === 0) {
      return {col, row};
    }
    // Buscar en direcciones adyacentes (ortogonales primero)
    const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
    for (const d of dirs) {
      const nc = col + d[0];
      const nr = row + d[1];
      if (this.navGrid[nr] && this.navGrid[nr][nc] === 0) {
        return {col: nc, row: nr};
      }
    }
    return {col, row}; // Fallback si todo está bloqueado
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
    const isDay = localStorage.getItem('office_theme') === 'day';
    const officeTexture = isDay ? 'floor_tile_day' : 'floor_tile';
    const loungeTexture = isDay ? 'lounge_tile_day' : 'lounge_tile';

    // 1. Textura en mosaico para la Oficina (0 a 18 columnas)
    this.officeFloor = this.add.tileSprite(0, 0, 18 * GRID_SIZE, ROWS * GRID_SIZE, officeTexture).setOrigin(0, 0).setDepth(-5);
    
    // 2. Textura en mosaico para el Lounge (18 a 27 columnas)
    this.loungeFloor = this.add.tileSprite(18 * GRID_SIZE, 0, 9 * GRID_SIZE, ROWS * GRID_SIZE, loungeTexture).setOrigin(0, 0).setDepth(-5);
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
    
    const isStructure = structureKeys.has(propData.type);
    const depth = isStructure ? (propData.type.includes('floor') ? -4 : -2) : propData.y;
    sprite.setDepth(depth);
    
    sprite.setData('propId', propData.id);
    sprite.setData('propType', propData.type);
    
    // Hacer prop interactivo (solo props de objetos se arrastran; estructura se pinta con pincel)
    if (!isStructure) {
      sprite.setInteractive({ useHandCursor: true, draggable: true });
      
      sprite.on('dragstart', () => {
        if (this.mode === 'EDIT_LAYOUT') {
          this.isDraggingObject = true;
        }
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
        if (this.mode !== 'EDIT_LAYOUT') return;
        this.isDraggingObject = false;
        if (propData.x !== sprite.x || propData.y !== sprite.y) {
          propData.x = sprite.x;
          propData.y = sprite.y;
          this.saveState();
        }
      });
    } else {
      sprite.setInteractive({ useHandCursor: true, draggable: false });
    }
    
    sprite.on('pointerdown', (pointer) => {
      if (((this.mode === 'EDIT_LAYOUT' && !isStructure) || (this.mode === 'EDIT_STRUCTURE' && isStructure)) && pointer.event.shiftKey) {
        window.levelData.props = window.levelData.props.filter(p => p.id !== propData.id);
        sprite.destroy();
        this.propSprites = this.propSprites.filter(s => s !== sprite);
        this.saveState();
      }
    });

    sprite.on('pointerover', () => {
      if ((this.mode === 'EDIT_LAYOUT' && !isStructure) || (this.mode === 'EDIT_STRUCTURE' && isStructure)) {
        this.hoveredProp = sprite;
      }
    });

    sprite.on('pointerout', () => {
      if (this.hoveredProp === sprite) this.hoveredProp = null;
    });
    
    this.propSprites.push(sprite);
    return sprite;
  }

  createElevator() {
    // La lógica del elevador (punto de spawn/despawn) se mantiene en this.doorGridPos,
    // pero se elimina su representación visual hardcodeada para que la escena
    // contenga únicamente el piso y los objetos añadidos manualmente.
  }

  // ==========================================
  // Herramientas del Modo Editor
  // ==========================================
  placeNewProp(propType, x, y, width, height, rotation = 0) {
    const newId = 'prop_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    const propData = {
      id: newId,
      type: propType,
      x: x,
      y: y,
      width: width,
      height: height,
      rotation: rotation
    };
    
    window.levelData.props.push(propData);
    this.createPropSprite(propData);
    
    this.saveState();
  }

  paintStructure(pointer) {
    if (!this.activeStructureBrush) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;

    // Verificar límites del mapa
    if (snappedX < 0 || snappedX >= COLS * GRID_SIZE || snappedY < 0 || snappedY >= ROWS * GRID_SIZE) {
      return;
    }

    const brushType = this.activeStructureBrush.id;
    const rot = this.structureBrushRotation || 0;

    // Verificar si ya existe una estructura en esa celda exacta
    const existingIndex = window.levelData.props.findIndex(p => 
      p.x === snappedX && p.y === snappedY && (p.type.includes('floor') || p.type.includes('wall'))
    );

    if (existingIndex !== -1) {
      const existing = window.levelData.props[existingIndex];
      // Si ya está el mismo bloque idéntico con la misma rotación, no duplicar
      if (existing.type === brushType && existing.width === 32 && existing.height === 32 && (existing.rotation || 0) === rot) {
        return;
      }
      // Si es otro bloque (ej. cambiar alfombra por madera o pared), reemplazarlo
      const oldSprite = this.propSprites.find(s => s.getData('propId') === existing.id);
      if (oldSprite) {
        oldSprite.destroy();
        this.propSprites = this.propSprites.filter(s => s !== oldSprite);
      }
      window.levelData.props.splice(existingIndex, 1);
    }

    this.placeNewProp(brushType, snappedX, snappedY, 32, 32, rot);
  }

  eraseStructureAt(pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const snappedX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;

    const existingIndex = window.levelData.props.findIndex(p => 
      p.x === snappedX && p.y === snappedY && (p.type.includes('floor') || p.type.includes('wall'))
    );

    if (existingIndex !== -1) {
      const existing = window.levelData.props[existingIndex];
      const oldSprite = this.propSprites.find(s => s.getData('propId') === existing.id);
      if (oldSprite) {
        oldSprite.destroy();
        this.propSprites = this.propSprites.filter(s => s !== oldSprite);
      }
      window.levelData.props.splice(existingIndex, 1);
      this.saveState();
    }
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
    let { agentId, agentRole, state, timestamp } = event;
    if (!agentId) return;
    
    // Convertir el rol raw del log (ej. "ingeniero de datos") a un rol estándar (ej. "dba")
    agentRole = mapRawRoleToKey(agentRole);

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

    const logMsg = event.metadata?.detailMessage 
      || event.metadata?.rawContentSnippet 
      || (event.metadata?.toolInUse ? `Herramienta: ${event.metadata.toolInUse}` : null)
      || `Estado: ${state}`;

    if (!avatar) {
      const startPx = this.gridToPx(this.doorGridPos.col, this.doorGridPos.row);
      avatar = new Avatar(this, startPx.x, startPx.y, agentId, agentRole);
      const initialTime = eventTime || this.currentSimTime || Date.now();
      avatar.startTime = initialTime;
      avatar.lastSimActivity = initialTime;
      avatar.lastLogMessage = logMsg;
      avatar.lastLogTime = initialTime;
      if (event.agentName) avatar.setAgentName(event.agentName);
      this.agents.set(agentId, avatar);

      if (isJumpReplay && avatar.assignedDesk) {
        const deskPx = this.gridToPx(avatar.assignedDesk.col, avatar.assignedDesk.row);
        avatar.setPosition(deskPx.x, deskPx.y);
      }
    } else {
      avatar.lastLogMessage = logMsg;
      const effectiveTime = eventTime || this.currentSimTime || Date.now();
      avatar.lastLogTime = effectiveTime;
      avatar.lastSimActivity = effectiveTime;
      avatar.lastRealActivity = Date.now();
      if (event.agentName && avatar.agentName !== event.agentName) {
        avatar.setAgentName(event.agentName);
      }
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
    
    const REST_THRESHOLD = 300000; // 5 minutos sim-time para descansar
    const DESPAWN_THRESHOLD = 1800000; // 30 minutos sin logs = irse de la oficina
    
    for (const [id, avatar] of this.agents.entries()) {
      const { diffMs, minutesWaiting } = avatar.getInactivityMetrics ? avatar.getInactivityMetrics() : { diffMs: this.currentSimTime - avatar.lastSimActivity, minutesWaiting: 0 };
      
      if (diffMs > DESPAWN_THRESHOLD) {
        if (!avatar.isDespawning) {
          avatar.isDespawning = true;
          const doorPx = this.gridToPx(this.doorGridPos.col, this.doorGridPos.row);
          avatar.despawn(doorPx, () => {
            this.agents.delete(id);
          });
        }
      } else if (minutesWaiting >= 5 || diffMs > REST_THRESHOLD) {
        if (!avatar.isDespawning && avatar.fsm.state !== 'RESTING') {
          // Forzar descanso
          avatar.handleTelemetryState('RESTING', avatar.lastSimActivity, true);
        }
      }
    }
  }

  checkInactivityRealtime() {
    const now = Date.now();
    if (this._lastRealtimeCheck && now - this._lastRealtimeCheck < 1000) return;
    this._lastRealtimeCheck = now;

    const REALTIME_REST_THRESHOLD = 300000; // 5 minutos en tiempo real sin logs
    const REALTIME_DESPAWN_THRESHOLD = 1800000; // 30 minutos en tiempo real sin logs

    for (const [id, avatar] of this.agents.entries()) {
      const { diffMs, minutesWaiting } = avatar.getInactivityMetrics ? avatar.getInactivityMetrics() : { diffMs: (avatar.lastRealActivity ? now - avatar.lastRealActivity : 0), minutesWaiting: 0 };
      
      if (diffMs > REALTIME_DESPAWN_THRESHOLD) {
        if (!avatar.isDespawning) {
          avatar.isDespawning = true;
          const doorPx = this.gridToPx(this.doorGridPos.col, this.doorGridPos.row);
          avatar.despawn(doorPx, () => {
            this.agents.delete(id);
          });
        }
      } else if (minutesWaiting >= 5 || diffMs > REALTIME_REST_THRESHOLD) {
        if (!avatar.isDespawning && avatar.fsm.state !== 'RESTING') {
          avatar.handleTelemetryState('RESTING', avatar.lastSimActivity, true);
        }
      }
    }
  }

  resetOffice() {
    this.agents.forEach(a => a.destroy(true));
    this.agents.clear();
  }
}
