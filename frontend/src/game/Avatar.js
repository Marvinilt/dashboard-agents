import Phaser from 'phaser';
import { mapRawRoleToKey } from './agentMapper.js';

export const ROLE_COLORS = {
  team_leader: 0x38bdf8,
  designer: 0xf43f5e,
  dba: 0xf59e0b,
  developer: 0x3b82f6,
  qa_tester: 0x10b981,
  security: 0xef4444,
  documenter: 0xa855f7,
  document: 0xa855f7,
  document_sprite: 0xa855f7,
  docs: 0xa855f7
};

export const ROLE_LABELS = {
  team_leader: 'Líder',
  designer: 'Diseño',
  dba: 'DBA',
  developer: 'Dev',
  qa_tester: 'QA',
  security: 'Seguridad',
  documenter: 'Docs',
  document: 'Docs',
  document_sprite: 'Docs',
  docs: 'Docs'
};

export const ROLE_TO_SPRITE = {
  team_leader: 'avatar_jefe',
  designer: 'avatar_designer',
  dba: 'avatar_dba',
  developer: 'avatar_developer',
  qa_tester: 'avatar_qa',
  security: 'avatar_security',
  documenter: 'avatar_documenter',
  document: 'avatar_documenter',
  document_sprite: 'avatar_documenter',
  docs: 'avatar_documenter'
};

// Mapeo de frames en avatares_working_sprite.png (3x2 grid) para la pose de escritorio frontal (sin piernas / tecleando)
// Fila 0: 0=QA, 1=Dev, 2=Diseñadora | Fila 1: 3=DBA, 4=Security, 5=Documenter
export const ROLE_TO_WORKING_FRAME = {
  qa_tester: 0,
  qa: 0,
  developer: 1,
  dev: 1,
  designer: 2,
  dba: 3,
  security: 4,
  documenter: 5,
  document: 5,
  document_sprite: 5,
  docs: 5
};

// Escala base para todos los avatares (un poco más grandes: 0.085 vs 0.07)
export const AVATAR_SCALE = 0.085;

// ==========================================
// Máquina de Estados Finita (FSM)
// ==========================================
class StateMachine {
  constructor(initialState, possibleStates, stateArgs) {
    this.initialState = initialState;
    this.possibleStates = possibleStates;
    this.stateArgs = stateArgs;
    this.state = null;

    for (const state of Object.values(this.possibleStates)) {
      state.stateMachine = this;
    }
  }

  step() {
    if (this.state === null) {
      this.state = this.initialState;
      this.possibleStates[this.state].enter(...this.stateArgs);
    }
    this.possibleStates[this.state].execute(...this.stateArgs);
  }

  transition(newState, ...enterArgs) {
    if (this.state === newState) return;
    this.possibleStates[this.state].exit(...this.stateArgs);
    this.state = newState;
    this.possibleStates[this.state].enter(...this.stateArgs, ...enterArgs);
  }
}

// ==========================================
// Estados del Avatar
// ==========================================
class State {
  enter(avatar) {}
  execute(avatar) {}
  exit(avatar) {}
}

class SpawningState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('');
    avatar.setScale(0);
    avatar.setAlpha(0);

    if (avatar.spawnTween) {
      avatar.spawnTween.stop();
      avatar.spawnTween = null;
    }

    avatar.spawnTween = avatar.scene.tweens.add({
      targets: avatar,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        avatar.spawnTween = null;
        if (avatar.fsm && avatar.fsm.state === 'SPAWNING') {
          avatar.goToWorkstation();
        }
      }
    });

    // Iniciar de inmediato la caminata a su posición de trabajo respectiva
    avatar.goToWorkstation();
  }

  exit(avatar) {
    if (!avatar.spawnTween) {
      avatar.setScale(1);
      avatar.setAlpha(1);
    }
  }
}

class IdleState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('');
    
    // Si está en su escritorio asignado, tomar pose sentado
    if (avatar.assignedDesk && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedDesk.direction || 'down', true);
    } else if (avatar.assignedLounge && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedLounge.direction || 'up', false);
    } else if (avatar.sprite) {
      avatar.applyStandingFrame(0);
    }

    avatar.idleBreathTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      scaleY: { from: AVATAR_SCALE, to: AVATAR_SCALE * 1.02 },
      scaleX: { from: AVATAR_SCALE, to: AVATAR_SCALE * 0.985 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  exit(avatar) {
    if (avatar.idleBreathTween) {
      avatar.idleBreathTween.stop();
      avatar.idleBreathTween = null;
      if (avatar.sprite) avatar.sprite.setScale(AVATAR_SCALE);
    }
  }
}

class MovingState extends State {
  enter(avatar, targetX, targetY, onComplete) {
    avatar.statusBubble.setText('');
    avatar.stopBreathingAnimation();

    if (avatar.sprite) {
      avatar.applyStandingFrame(0);
    }

    if (avatar.walkBobTween) {
      avatar.walkBobTween.stop();
      avatar.walkBobTween = null;
    }

    // Animación de rebote sutil de pasos con squash & stretch
    avatar.walkBobTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      y: -13,
      scaleX: AVATAR_SCALE * 1.04,
      scaleY: AVATAR_SCALE * 0.96,
      duration: 110,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const startPos = avatar.scene.pxToGrid(avatar.x, avatar.y);
    let endPos = avatar.scene.pxToGrid(targetX, targetY);
    
    // Asegurarse de que el destino sea caminable (por si el nodo está sobre una mesa o colisión)
    endPos = avatar.scene.getWalkableAdjacent(endPos.col, endPos.row);

    avatar.scene.finder.findPath(startPos.col, startPos.row, endPos.col, endPos.row, (path) => {
      if (!avatar.active || avatar.fsm?.state !== 'MOVING') return;

      if (path === null || path.length === 0) {
        console.warn(`[Pathfinding] No se encontró ruta para ${avatar.agentId}`);
        avatar.fsm.transition('IDLE');
        if (onComplete) onComplete();
        return;
      }

      // Si hay al menos un paso, orientar inmediatamente al avatar hacia la dirección inicial
      if (path.length > 1) {
        avatar.setWalkingDirection(path[1].x - path[0].x, path[1].y - path[0].y);
      }
      
      const tweensParams = [];
      path.forEach((node, index) => {
        if (index === 0) return; // Skip inicio
        const prevNode = path[index - 1];
        const dx = node.x - prevNode.x;
        const dy = node.y - prevNode.y;
        const px = avatar.scene.gridToPx(node.x, node.y);

        tweensParams.push({
          targets: avatar,
          x: px.x,
          y: px.y,
          duration: 200, // ms por celda
          ease: 'Linear',
          onStart: () => {
            avatar.setWalkingDirection(dx, dy);
            avatar.emitFootstepDust();
          },
          onUpdate: () => {
            avatar.setDepth(8000 + avatar.y);
          }
        });
      });

      if (tweensParams.length === 0) {
        avatar.fsm.transition('IDLE');
        if (onComplete) onComplete();
        return;
      }

      avatar.pathChain = avatar.scene.tweens.chain({
        tweens: tweensParams,
        onComplete: () => {
          avatar.pathChain = null;
          avatar.fsm.transition('IDLE');
          if (onComplete) onComplete();
        }
      });
    });
  }

  exit(avatar) {
    if (avatar.pathChain) {
      avatar.pathChain.destroy();
      avatar.pathChain = null;
    }
    if (avatar.walkBobTween) {
      avatar.walkBobTween.stop();
      avatar.walkBobTween = null;
    }
    if (avatar.walkSwayTween) {
      avatar.walkSwayTween.stop();
      avatar.walkSwayTween = null;
    }
    if (avatar.sprite) {
      avatar.sprite.setY(-16);
      avatar.sprite.setScale(AVATAR_SCALE);
      avatar.sprite.setAngle(0);
    }
    avatar.setRotation(0);
  }
}

class WorkingState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('💭');
    
    if (avatar.assignedDesk && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedDesk.direction || 'down', true);
    } else if (avatar.sprite) {
      avatar.applyStandingFrame(0);
    }

    // 1. Animación de Tecleo / Concentración
    avatar.typingTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      y: { from: -6, to: -7.5 },
      scaleX: { from: AVATAR_SCALE, to: AVATAR_SCALE * 1.014 },
      scaleY: { from: AVATAR_SCALE, to: AVATAR_SCALE * 0.985 },
      duration: 130,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    avatar.typingSwayTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      angle: { from: -1.2, to: 1.2 },
      duration: 240,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. Globo flotante suave
    avatar.bubbleFloatTween = avatar.scene.tweens.add({
      targets: avatar.statusBubble,
      y: { from: -60, to: -64 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 3. Destellos sutiles de monitor
    avatar.startMonitorSparks();
  }

  exit(avatar) {
    if (avatar.typingTween) {
      avatar.typingTween.stop();
      avatar.typingTween = null;
    }
    if (avatar.typingSwayTween) {
      avatar.typingSwayTween.stop();
      avatar.typingSwayTween = null;
    }
    if (avatar.bubbleFloatTween) {
      avatar.bubbleFloatTween.stop();
      avatar.bubbleFloatTween = null;
      avatar.statusBubble.setY(-60);
    }
    avatar.stopMonitorSparks();

    if (avatar.sprite) {
      avatar.sprite.setScale(AVATAR_SCALE);
      avatar.sprite.setAngle(0);
      // Nota: No cambiamos a Frame 0 (parado) aquí porque si pasa a THINKING, WAITING o IDLE,
      // el avatar debe permanecer sentado en su silla. MovingState se encargará de ponerlo de pie.
    }
  }
}

class ThinkingState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('💭');

    if (avatar.assignedDesk && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedDesk.direction || 'down', true);
    } else if (avatar.assignedLounge && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedLounge.direction || 'up', false);
    } else if (avatar.sprite) {
      avatar.applyStandingFrame(0);
    }
    
    // Balanceo reflexivo lento
    avatar.thinkSwayTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      angle: { from: -2.5, to: 2.5 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Respiración lenta pensativa
    avatar.thinkBreathTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      scaleY: { from: AVATAR_SCALE, to: AVATAR_SCALE * 1.028 },
      scaleX: { from: AVATAR_SCALE, to: AVATAR_SCALE * 0.97 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Globo de pensamiento pulsante suave
    avatar.thinkBubbleTween = avatar.scene.tweens.add({
      targets: avatar.statusBubble,
      scale: { from: 0.95, to: 1.2 },
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  exit(avatar) {
    if (avatar.thinkSwayTween) {
      avatar.thinkSwayTween.stop();
      avatar.thinkSwayTween = null;
    }
    if (avatar.thinkBreathTween) {
      avatar.thinkBreathTween.stop();
      avatar.thinkBreathTween = null;
    }
    if (avatar.thinkBubbleTween) {
      avatar.thinkBubbleTween.stop();
      avatar.thinkBubbleTween = null;
      avatar.statusBubble.setScale(1);
    }
    if (avatar.sprite) {
      avatar.sprite.setAngle(0);
      avatar.sprite.setScale(AVATAR_SCALE);
    }
  }
}

class WaitingInputState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('⚠️');

    if (avatar.assignedDesk && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedDesk.direction || 'down', true);
    } else if (avatar.assignedLounge && avatar.sprite) {
      avatar.applySeatedFrame(avatar.assignedLounge.direction || 'up', false);
    } else if (avatar.sprite) {
      avatar.applyStandingFrame(0);
    }
    
    avatar.pulseTween = avatar.scene.tweens.add({
      targets: avatar.statusBubble,
      scale: 1.35,
      duration: 280,
      yoyo: true,
      repeat: -1
    });

    avatar.impatientSwayTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      angle: { from: -4, to: 4 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  exit(avatar) {
    if (avatar.pulseTween) {
      avatar.pulseTween.stop();
      avatar.pulseTween = null;
      avatar.statusBubble.setScale(1);
    }
    if (avatar.impatientSwayTween) {
      avatar.impatientSwayTween.stop();
      avatar.impatientSwayTween = null;
      if (avatar.sprite) avatar.sprite.setAngle(0);
    }
  }
}

class RestingState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('');
    avatar.setAlpha(0.9);
    
    if (avatar.sprite && avatar.assignedLounge) {
      avatar.applySeatedFrame(avatar.assignedLounge.direction || 'up', false);

      const dir = avatar.assignedLounge.direction || 'up';
      const reclineAngle = dir === 'right' ? -3 : (dir === 'left' ? 3 : 0);
      avatar.sprite.setAngle(reclineAngle);
    } else if (avatar.sprite) {
      avatar.applyStandingFrame(0);
    }

    avatar.sleepBreathTween = avatar.scene.tweens.add({
      targets: avatar.sprite,
      scaleY: { from: AVATAR_SCALE * 0.97, to: AVATAR_SCALE * 1.03 },
      scaleX: { from: AVATAR_SCALE * 1.014, to: AVATAR_SCALE * 0.985 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    avatar.startFloatingZzz();
  }

  exit(avatar) {
    avatar.setAlpha(1.0);
    if (avatar.sleepBreathTween) {
      avatar.sleepBreathTween.stop();
      avatar.sleepBreathTween = null;
    }
    avatar.stopFloatingZzz();

    if (avatar.sprite) {
      const baseSpriteKey = ROLE_TO_SPRITE[avatar.agentRole] || 'avatar_jefe';
      const finalSpriteKey = avatar.scene.textures.exists(baseSpriteKey) ? baseSpriteKey : 'avatar_jefe';
      avatar.sprite.setTexture(finalSpriteKey, 0);
      avatar.sprite.setY(-16);
      avatar.sprite.setScale(AVATAR_SCALE);
      avatar.sprite.setAngle(0);
    }
  }
}

class DespawningState extends State {
    enter(avatar, doorCoordinates, onFinished) {
      avatar.statusBubble.setText('');
    // Transiciona a moverse a la puerta, y luego se desintegra
    avatar.fsm.transition('MOVING', doorCoordinates.x, doorCoordinates.y, () => {
      avatar.scene.tweens.add({
        targets: avatar,
        alpha: 0,
        scale: 0.2,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          avatar.destroy();
          if (onFinished) onFinished();
        }
      });
    });
  }
}

// ==========================================
// Clase Principal Avatar (Container)
// ==========================================
export class Avatar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, agentId, agentRole = 'team_leader') {
    super(scene, x, y);
    this.scene = scene;
    this.agentId = agentId;
    this.agentRole = agentRole;
    this.agentName = ROLE_LABELS[agentRole] || agentRole;
    this.lastLogMessage = 'Inicializado en oficina';
    this.lastLogTime = Date.now();
    this.assignedDesk = this.scene.getRandomDesk(this.agentRole);
    this.assignedLounge = null;
    this.lastSimActivity = Date.now();
    this.isHovered = false;
    
    // Componentes visuales
    this.buildGraphics();

    // Inicializar FSM
    this.fsm = new StateMachine('SPAWNING', {
      SPAWNING: new SpawningState(),
      IDLE: new IdleState(),
      MOVING: new MovingState(),
      WORKING: new WorkingState(),
      THINKING: new ThinkingState(),
      WAITING_INPUT: new WaitingInputState(),
      RESTING: new RestingState(),
      DESPAWNING: new DespawningState(),
    }, [this]);

    this.fsm.step(); // Ejecutar primer estado

    // Interactividad
    this.setSize(40, 56);
    this.setInteractive(new Phaser.Geom.Rectangle(-20, -28, 40, 56), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => this.scene.events.emit('AGENT_CLICKED', this));
    this.on('pointerover', () => {
      this.isHovered = true;
      if (!this.spawnTween) this.setScale(1.1);
      this.emitHoverEvent();
    });
    this.on('pointermove', () => {
      if (this.isHovered) {
        this.emitHoverEvent();
      }
    });
    this.on('pointerout', () => {
      this.isHovered = false;
      if (!this.spawnTween) this.setScale(1.0);
      this.scene.events.emit('AGENT_HOVER_OUT', { agentId: this.agentId });
    });

    this.setDepth(8000 + this.y);
    scene.add.existing(this);
  }

  emitHoverEvent() {
    if (!this.active || !this.scene || !this.scene.sys) return;
    const currentTime = this.scene.currentSimTime || Date.now();
    const diffMs = Math.max(0, currentTime - (this.lastLogTime || this.lastSimActivity || currentTime));
    const minutesWaiting = Math.floor(diffMs / 60000);

    const cam = this.scene.cameras.main;
    const screenX = (this.x - cam.scrollX) * cam.zoom;
    const screenY = (this.y - 35 - cam.scrollY) * cam.zoom;

    const canvas = this.scene.sys.game?.canvas;
    const gameW = this.scene.sys.game?.scale?.gameSize?.width || 928;
    const gameH = this.scene.sys.game?.scale?.gameSize?.height || 576;
    let clientX = 0;
    let clientY = 0;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      clientX = rect.left + (screenX / gameW) * rect.width;
      clientY = rect.top + (screenY / gameH) * rect.height;
    }

    this.scene.events.emit('AGENT_HOVER', {
      agentId: this.agentId,
      agentRole: this.agentRole,
      agentName: this.agentName || ROLE_LABELS[this.agentRole] || this.agentRole,
      minutesWaiting,
      lastLogMessage: this.lastLogMessage,
      state: this.fsm?.state || 'IDLE',
      clientX,
      clientY,
      screenX,
      screenY
    });
  }

  buildGraphics() {
    // 1. Sombra base
    const shadow = this.scene.add.ellipse(0, 18, 30, 14, 0x000000, 0.4);
    this.add(shadow);

    // 2. Mapeo del Sprite
    const normalizedRole = mapRawRoleToKey(this.agentRole);
    const targetSpriteKey = ROLE_TO_SPRITE[this.agentRole] || ROLE_TO_SPRITE[normalizedRole] || 'avatar_jefe';
    // Validamos si el spritesheet realmente fue cargado en el preload, si no, usamos el del jefe como placeholder
    const finalSpriteKey = this.scene.textures.exists(targetSpriteKey) ? targetSpriteKey : 'avatar_jefe';

    this.sprite = this.scene.add.sprite(0, -16, finalSpriteKey, 0); // Frame 0
    this.sprite.setScale(AVATAR_SCALE); // Ajustamos tamaño para todos
    this.add(this.sprite);
    this.bodyVisual = this.sprite;

    // 3. Etiqueta de Rol
    const labelText = ROLE_LABELS[this.agentRole] || ROLE_LABELS[normalizedRole] || this.agentRole.slice(0, 8);
    this.label = this.scene.add.text(0, -44, labelText, {
      fontSize: '10px',
      fontFamily: 'monospace',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: { x: 4, y: 1 }
    }).setOrigin(0.5);
    this.add(this.label);

    // 4. Icono de Estado (Bubble)
    this.statusBubble = this.scene.add.text(0, -60, '', {
      fontSize: '16px'
    }).setOrigin(0.5);
    this.add(this.statusBubble);
  }

  startBreathingAnimation() {
    // Manejado internamente por cada estado FSM
  }

  stopBreathingAnimation() {
    // Manejado internamente por cada estado FSM
  }

  setWalkingDirection(dx, dy) {
    if (!this.sprite) return;
    let frame = 0; // Frente (abajo) por defecto
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      frame = dx > 0 ? 2 : 3; // 2: derecha, 3: izquierda
      const targetAngle = dx > 0 ? 5 : -5;
      if (this.walkSwayTween) this.walkSwayTween.stop();
      this.walkSwayTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: { from: targetAngle - 2, to: targetAngle + 2 },
        duration: 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (dy !== 0) {
      frame = dy > 0 ? 0 : 1; // 0: abajo (frente), 1: arriba (espalda)
      if (this.walkSwayTween) this.walkSwayTween.stop();
      this.walkSwayTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: { from: -3.5, to: 3.5 },
        duration: 110,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    this.sprite.setFrame(frame);
    this.facingDirection = dx > 0 ? 'right' : (dx < 0 ? 'left' : (dy < 0 ? 'up' : 'down'));
  }

  applySeatedFrame(dir = 'down', isDesk = true) {
    if (!this.sprite) return;
    const normalizedRole = mapRawRoleToKey(this.agentRole);
    const workingFrame = ROLE_TO_WORKING_FRAME[this.agentRole] !== undefined
      ? ROLE_TO_WORKING_FRAME[this.agentRole]
      : ROLE_TO_WORKING_FRAME[normalizedRole];

    if (isDesk && workingFrame !== undefined && this.scene.textures.exists('avatares_working') && dir !== 'left' && dir !== 'right') {
      this.sprite.setTexture('avatares_working', workingFrame);
      this.sprite.setY(-6);
      this.sprite.setScale(AVATAR_SCALE);
      this.sprite.setAngle(0);
    } else {
      const baseSpriteKey = ROLE_TO_SPRITE[this.agentRole] || ROLE_TO_SPRITE[normalizedRole] || 'avatar_jefe';
      const finalSpriteKey = this.scene.textures.exists(baseSpriteKey) ? baseSpriteKey : 'avatar_jefe';
      this.sprite.setTexture(finalSpriteKey);

      let frame = 5; // up (espalda)
      if (dir === 'down') frame = 4; // frente (cuerpo completo con piernas)
      else if (dir === 'right') frame = 6; // perfil derecho
      else if (dir === 'left') frame = 7; // perfil izquierdo

      this.sprite.setFrame(frame);
      this.sprite.setY(-6);
      this.sprite.setScale(AVATAR_SCALE);
      this.sprite.setAngle(0);
    }
  }

  applyStandingFrame(frame = 0) {
    if (!this.sprite) return;
    const normalizedRole = mapRawRoleToKey(this.agentRole);
    const baseSpriteKey = ROLE_TO_SPRITE[this.agentRole] || ROLE_TO_SPRITE[normalizedRole] || 'avatar_jefe';
    const finalSpriteKey = this.scene.textures.exists(baseSpriteKey) ? baseSpriteKey : 'avatar_jefe';
    this.sprite.setTexture(finalSpriteKey, frame);
    this.sprite.setY(-16);
    this.sprite.setScale(AVATAR_SCALE);
    this.sprite.setAngle(0);
  }

  emitFootstepDust() {
    if (!this.scene || !this.scene.add) return;
    const dustX = this.x + Phaser.Math.Between(-4, 4);
    const dustY = this.y + 14;
    const dust = this.scene.add.circle(dustX, dustY, 2.5, 0x94a3b8, 0.4);
    dust.setDepth(7900);
    this.scene.tweens.add({
      targets: dust,
      scale: 1.8,
      alpha: 0,
      duration: 250,
      ease: 'Sine.easeOut',
      onComplete: () => dust.destroy()
    });
  }

  startMonitorSparks() {
    this.stopMonitorSparks();
    if (!this.assignedDesk) return;
    this.monitorSparkTimer = this.scene.time.addEvent({
      delay: 750,
      loop: true,
      callback: () => {
        if (!this.active || this.fsm.state !== 'WORKING') return;
        const sparkColors = [0x38bdf8, 0x818cf8, 0x34d399];
        const color = sparkColors[Phaser.Math.Between(0, sparkColors.length - 1)];
        const spark = this.scene.add.circle(this.x + Phaser.Math.Between(-8, 8), this.y - 12, 1.8, color, 0.7);
        spark.setDepth(this.depth + 1);
        this.scene.tweens.add({
          targets: spark,
          y: spark.y - 12,
          alpha: 0,
          scale: 0.5,
          duration: 450,
          ease: 'Sine.easeOut',
          onComplete: () => spark.destroy()
        });
      }
    });
  }

  stopMonitorSparks() {
    if (this.monitorSparkTimer) {
      this.monitorSparkTimer.remove();
      this.monitorSparkTimer = null;
    }
  }

  startFloatingZzz() {
    this.stopFloatingZzz();
    this.emitSingleZ();
    this.zzzTimer = this.scene.time.addEvent({
      delay: 1300,
      loop: true,
      callback: () => {
        if (!this.active || this.fsm.state !== 'RESTING') return;
        this.emitSingleZ();
      }
    });
  }

  emitSingleZ() {
    if (!this.scene || !this.scene.add) return;
    const zLetters = ['z', 'Z', 'z'];
    const letter = zLetters[Phaser.Math.Between(0, zLetters.length - 1)];
    const zText = this.scene.add.text(this.x + Phaser.Math.Between(4, 10), this.y - 42, letter, {
      fontSize: '13px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#93c5fd'
    }).setOrigin(0.5);
    zText.setDepth(9500);

    this.scene.tweens.add({
      targets: zText,
      y: zText.y - 28,
      x: zText.x + Phaser.Math.Between(8, 16),
      scale: { from: 0.7, to: 1.3 },
      alpha: { from: 1, to: 0 },
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => zText.destroy()
    });
  }

  stopFloatingZzz() {
    if (this.zzzTimer) {
      this.zzzTimer.remove();
      this.zzzTimer = null;
    }
  }

  isAtDesk() {
    if (!this.assignedDesk || !this.scene) return false;
    const target = this.scene.gridToPx(this.assignedDesk.col, this.assignedDesk.row);
    return Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) <= 24;
  }

  isAtLounge() {
    if (!this.assignedLounge || !this.scene) return false;
    const target = this.scene.gridToPx(this.assignedLounge.col, this.assignedLounge.row);
    return Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) <= 24;
  }

  goToWorkstation(onComplete) {
    if (this.assignedDesk) {
      const isValid = (window.levelData?.interactionNodes || []).some(
        n => n.type === 'node_work' && n.col === this.assignedDesk.col && n.row === this.assignedDesk.row
      );
      if (!isValid && (window.levelData?.interactionNodes || []).some(n => n.type === 'node_work')) {
        this.assignedDesk = null;
      }
    }

    if (!this.assignedDesk) {
      this.assignedDesk = this.scene.getRandomDesk(this.agentRole);
      this.assignedLounge = null;
    }

    if (!this.assignedDesk) return;

    const target = this.scene.gridToPx(this.assignedDesk.col, this.assignedDesk.row);
    if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) > 10) {
      this.fsm.transition('MOVING', target.x, target.y, () => {
        const nextState = (this.pendingState && this.pendingState !== 'SPAWNING' && this.pendingState !== 'MOVING')
          ? this.pendingState
          : 'WORKING';
        this.pendingState = null;
        this.fsm.transition(nextState);
        if (onComplete) onComplete();
      });
    } else {
      const nextState = (this.pendingState && this.pendingState !== 'SPAWNING' && this.pendingState !== 'MOVING')
        ? this.pendingState
        : 'WORKING';
      this.pendingState = null;
      this.fsm.transition(nextState);
      if (onComplete) onComplete();
    }
  }

  // Interfaz pública para cambiar estados desde el Manager
  handleTelemetryState(telemetryState, simTime = null, isAutoRest = false) {
    if (!isAutoRest) {
      this.lastSimActivity = simTime || Date.now();
      this.lastRealActivity = Date.now();
    }
    this.pendingState = telemetryState;
    
    // Normalize state to a known FSM state
    let fsmTargetState = 'WORKING';
    const tlUpper = (telemetryState || '').toUpperCase();

    if (tlUpper.includes('WAIT')) fsmTargetState = 'WAITING_INPUT';
    else if (tlUpper.includes('THINK') || tlUpper.includes('PLAN')) fsmTargetState = 'THINKING';
    else if (tlUpper.includes('REST') || tlUpper.includes('SLEEP')) fsmTargetState = 'RESTING';
    else if (tlUpper.includes('DONE') || tlUpper.includes('SUCCESS') || tlUpper.includes('IDLE')) fsmTargetState = 'IDLE';
    else if (['MOVING', 'DESPAWNING'].includes(tlUpper)) fsmTargetState = tlUpper;
    else fsmTargetState = 'WORKING';

    // Si aún está en pleno movimiento o apareciendo, guardamos en pendingState y respetamos la ruta
    if (this.fsm.state === 'MOVING' || this.fsm.state === 'SPAWNING') {
      return;
    }

    // Mapeo del estado del log al estado interno FSM
    if (fsmTargetState === 'RESTING') {
      if (this.assignedLounge) {
        const isValid = (window.levelData?.interactionNodes || []).some(
          n => n.type === 'node_lounge' && n.col === this.assignedLounge.col && n.row === this.assignedLounge.row
        );
        if (!isValid && (window.levelData?.interactionNodes || []).some(n => n.type === 'node_lounge')) {
           this.assignedLounge = null;
        }
      }

      if (!this.assignedLounge) {
        this.assignedLounge = this.scene.getRandomLoungeSpot();
        this.assignedDesk = null; // Clear desk
      }
      
      const target = this.scene.gridToPx(this.assignedLounge.col, this.assignedLounge.row);
      if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) > 10) {
        this.fsm.transition('MOVING', target.x, target.y, () => {
          const nextState = this.pendingState || fsmTargetState;
          this.pendingState = null;
          this.fsm.transition(nextState);
        });
      } else if (this.fsm.state !== fsmTargetState) {
        this.fsm.transition(fsmTargetState);
      }
    } else {
      // Por defecto todos los estados activos van al escritorio
      if (this.assignedDesk) {
        const isValid = (window.levelData?.interactionNodes || []).some(
          n => n.type === 'node_work' && n.col === this.assignedDesk.col && n.row === this.assignedDesk.row
        );
        if (!isValid && (window.levelData?.interactionNodes || []).some(n => n.type === 'node_work')) {
           this.assignedDesk = null;
        }
      }
    
      if (!this.assignedDesk) {
        this.assignedDesk = this.scene.getRandomDesk(this.agentRole);
        this.assignedLounge = null; // Clear lounge if they go back to work
      }
      
      const target = this.scene.gridToPx(this.assignedDesk.col, this.assignedDesk.row);
      if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) > 10) {
        // Moverse al escritorio y luego transicionar
        this.fsm.transition('MOVING', target.x, target.y, () => {
          const nextState = (this.pendingState && this.pendingState !== 'SPAWNING' && this.pendingState !== 'MOVING')
            ? this.pendingState
            : fsmTargetState;
          this.pendingState = null;
          this.fsm.transition(nextState);
        });
      } else if (this.fsm.state !== fsmTargetState) {
        // Ya está ahí, cambiar estado directamente
        this.fsm.transition(fsmTargetState);
      }
    }
  }

  moveTo(targetX, targetY, onComplete) {
    this.fsm.transition('MOVING', targetX, targetY, onComplete);
  }

  despawn(doorCoordinates, onFinished) {
    this.fsm.transition('DESPAWNING', doorCoordinates, onFinished);
  }

  update() {
    // Asegurar que el avatar siempre esté por encima de todos los objetos del diseño (props tienen depth < 1000)
    // Se usa 8000 + this.y para que mantengan Y-sorting entre ellos mismos si se cruzan.
    this.setDepth(8000 + this.y);
    if (this.isHovered) {
      this.emitHoverEvent();
    }
  }

  destroy(fromScene) {
    if (this.isHovered && this.scene && this.scene.events) {
      this.scene.events.emit('AGENT_HOVER_OUT', { agentId: this.agentId });
    }
    if (this.spawnTween) {
      this.spawnTween.stop();
      this.spawnTween = null;
    }
    this.stopMonitorSparks();
    this.stopFloatingZzz();
    this.scene.tweens.killTweensOf(this);
    if (this.sprite) this.scene.tweens.killTweensOf(this.sprite);
    if (this.statusBubble) this.scene.tweens.killTweensOf(this.statusBubble);
    super.destroy(fromScene);
  }
}
