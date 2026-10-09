import Phaser from 'phaser';
import { generateProceduralTextures } from './assets.js';
import { Avatar } from './Avatar.js';
import { gameEvents, EVENTS } from './eventBus.js';

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super('OfficeScene');
    this.agents = new Map(); // agentId -> Avatar instance
    this.desks = [];
    this.doorPos = { x: 80, y: 380 };
    this.loungePos = { x: 740, y: 120 };
  }

  preload() {
    // Generar texturas de piso, muebles y puertas
    generateProceduralTextures(this);
  }

  create() {
    // 1. Dibujar piso de la oficina en cuadrícula isométrica
    this.createIsometricOfficeFloor();

    // 2. Puerta de Spawn / Entrada
    this.add.image(this.doorPos.x, this.doorPos.y - 20, 'door_portal');
    this.add.text(this.doorPos.x, this.doorPos.y + 15, 'ENTRADA', {
      fontSize: '9px',
      color: '#38bdf8',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 3. Sala de Descanso / Coffee Station (Esquina superior derecha)
    this.add.image(this.loungePos.x, this.loungePos.y, 'coffee_station');
    this.add.text(this.loungePos.x, this.loungePos.y + 35, 'COFFEE BREAK', {
      fontSize: '9px',
      color: '#f59e0b',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 4. Instanciar Escritorios de Trabajo
    this.createWorkstationDesks();

    // 5. Escuchar evento de clic en agente
    this.events.on('AGENT_CLICKED', (avatar) => {
      gameEvents.emit(EVENTS.AGENT_SELECTED, {
        agentId: avatar.agentId,
        agentRole: avatar.agentRole,
        state: avatar.state
      });
    });

    // 6. Temporizador periódico para verificar TTL y zona de descanso
    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => this.checkInactivityLifecycle()
    });

    console.log('[Phaser] Oficina inicializada y lista.');
  }

  createIsometricOfficeFloor() {
    const originX = 420;
    const originY = 80;
    const tileW = 64;
    const tileH = 32;
    const rows = 12;
    const cols = 12;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isoX = originX + (c - r) * (tileW / 2);
        const isoY = originY + (c + r) * (tileH / 2);

        // Si está en la esquina superior, es zona lounge
        const isLounge = (c >= 8 && r <= 4);
        const tileKey = isLounge ? 'lounge_tile' : 'floor_tile';

        this.add.image(isoX, isoY, tileKey).setDepth(0);
      }
    }
  }

  createWorkstationDesks() {
    // Matriz de escritorios distribuidos cómodamente
    const positions = [
      { x: 260, y: 170 }, { x: 380, y: 170 }, { x: 500, y: 170 },
      { x: 220, y: 260 }, { x: 340, y: 260 }, { x: 460, y: 260 },
      { x: 280, y: 350 }, { x: 400, y: 350 }, { x: 520, y: 350 }
    ];

    positions.forEach((pos, idx) => {
      const sprite = this.add.image(pos.x, pos.y, 'desk_workstation').setDepth(1);
      this.desks.push({
        id: `desk_${idx}`,
        x: pos.x,
        y: pos.y + 12, // Coordenada de la silla
        sprite,
        isOccupied: false,
        occupantId: null
      });
    });
  }

  // Manejador central de eventos que llegan por WebSockets
  handleTelemetryEvent(event) {
    const { agentId, agentRole, state, metadata } = event;
    if (!agentId) return;

    let avatar = this.agents.get(agentId);

    // Si el avatar aún no existe, spawnearlo
    if (!avatar) {
      avatar = this.spawnAvatar(agentId, agentRole || 'software_engineer');
    }

    avatar.setState(state, metadata?.detailMessage);

    // Si estaba en la zona de descanso y volvió a trabajar, mandarlo a un escritorio
    if (state === 'WORKING' && avatar.state === 'RESTING') {
      const availableDesk = this.findAvailableDesk();
      if (availableDesk) {
        avatar.assignedDesk = availableDesk;
        availableDesk.isOccupied = true;
        availableDesk.occupantId = agentId;
        avatar.walkTo(availableDesk.x, availableDesk.y);
      }
    }
  }

  spawnAvatar(agentId, role) {
    const avatar = new Avatar(this, this.doorPos.x, this.doorPos.y, agentId, role);
    avatar.setDepth(2);
    this.agents.set(agentId, avatar);

    // Asignar un escritorio disponible
    const desk = this.findAvailableDesk();
    if (desk) {
      desk.isOccupied = true;
      desk.occupantId = agentId;
      avatar.assignedDesk = desk;
      avatar.walkTo(desk.x, desk.y, () => {
        avatar.setState('WORKING');
      });
    } else {
      // Si no hay escritorio, va a la zona lounge
      avatar.walkTo(this.loungePos.x - 30, this.loungePos.y + 20, () => {
        avatar.setState('RESTING');
      });
    }

    return avatar;
  }

  findAvailableDesk() {
    return this.desks.find(d => !d.isOccupied);
  }

  // Ciclo de vida A + B: 3 min -> Lounge / 10 min -> Despawn
  checkInactivityLifecycle() {
    const now = Date.now();
    // Para propósitos interactivos, si estamos en demo/simulador, los tiempos se escalan:
    // 30 segundos sin eventos = Pase a Sala de Descanso
    // 90 segundos más sin eventos = Salida definitiva (Despawn)
    const SOFT_IDLE_MS = 35000;
    const HARD_TTL_MS = 90000;

    this.agents.forEach((avatar, agentId) => {
      const elapsed = now - avatar.lastActivity;

      if (elapsed > HARD_TTL_MS && avatar.state === 'RESTING') {
        console.log(`[Lifecycle] Agente ${agentId} cumplió Hard TTL. Despawneando...`);
        this.agents.delete(agentId);
        avatar.despawn(this.doorPos);
      } else if (elapsed > SOFT_IDLE_MS && avatar.state !== 'RESTING' && avatar.state !== 'WAITING_INPUT') {
        console.log(`[Lifecycle] Agente ${agentId} inactivo. Moviendo a Sala de Descanso...`);
        if (avatar.assignedDesk) {
          avatar.assignedDesk.isOccupied = false;
          avatar.assignedDesk.occupantId = null;
          avatar.assignedDesk = null;
        }
        avatar.setState('RESTING');
        avatar.walkTo(this.loungePos.x - 20, this.loungePos.y + 15);
      }
    });
  }

  resetOffice() {
    console.log('[Phaser] Limpiando oficina...');
    this.agents.forEach((avatar) => {
      avatar.destroy();
    });
    this.agents.clear();
    this.desks.forEach((desk) => {
      desk.isOccupied = false;
      desk.occupantId = null;
    });
  }
}
