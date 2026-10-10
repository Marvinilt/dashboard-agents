import Phaser from 'phaser';

export const ROLE_COLORS = {
  team_leader: 0x38bdf8,
  designer: 0xf43f5e,
  dba: 0xf59e0b,
  developer: 0x3b82f6,
  qa_tester: 0x10b981,
  security: 0xef4444,
  documenter: 0xa855f7
};

export const ROLE_LABELS = {
  team_leader: 'Líder',
  designer: 'Diseño',
  dba: 'DBA',
  developer: 'Dev',
  qa_tester: 'QA',
  security: 'Seguridad',
  documenter: 'Docs'
};

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
    avatar.statusBubble.setText('✨');
    avatar.setScale(0);
    avatar.setAlpha(0);
    avatar.scene.tweens.add({
      targets: avatar,
      scale: 1,
      alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        avatar.fsm.transition('IDLE');
      }
    });
  }
}

class IdleState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('');
    avatar.startBreathingAnimation();
  }
}

class MovingState extends State {
  enter(avatar, targetX, targetY, onComplete) {
    avatar.statusBubble.setText('🚶');
    avatar.stopBreathingAnimation();
    
    // Animación de bamboleo al caminar
    avatar.walkTween = avatar.scene.tweens.add({
      targets: avatar,
      rotation: 0.15,
      duration: 150,
      yoyo: true,
      repeat: -1
    });

    const startPos = avatar.scene.pxToGrid(avatar.x, avatar.y);
    const endPos = avatar.scene.pxToGrid(targetX, targetY);

    avatar.scene.finder.findPath(startPos.col, startPos.row, endPos.col, endPos.row, (path) => {
      if (path === null || path.length === 0) {
        console.warn(`[Pathfinding] No se encontró ruta para ${avatar.agentId}`);
        if (onComplete) onComplete();
        else avatar.fsm.transition('IDLE');
        return;
      }
      
      const tweensParams = [];
      path.forEach((node, index) => {
        if (index === 0) return; // Skip inicio
        const px = avatar.scene.gridToPx(node.x, node.y);
        tweensParams.push({
          targets: avatar,
          x: px.x,
          y: px.y,
          duration: 200, // ms por celda
          ease: 'Linear'
        });
      });

      if (tweensParams.length === 0) {
        if (onComplete) onComplete();
        else avatar.fsm.transition('IDLE');
        return;
      }

      avatar.pathChain = avatar.scene.tweens.chain({
        tweens: tweensParams,
        onComplete: () => {
          if (onComplete) onComplete();
          else avatar.fsm.transition('IDLE');
        }
      });
    });
  }

  exit(avatar) {
    if (avatar.walkTween) {
      avatar.walkTween.stop();
      avatar.walkTween = null;
    }
    if (avatar.pathChain) {
      avatar.pathChain.destroy();
      avatar.pathChain = null;
    }
    avatar.setRotation(0);
  }
}

class WorkingState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('⚙️');
    avatar.startBreathingAnimation();
    
    // Animación de trabajo (inclinándose levemente / tecleando)
    avatar.workTween = avatar.scene.tweens.add({
      targets: avatar.bodyGraphics,
      scaleY: 0.95,
      duration: 150,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  exit(avatar) {
    if (avatar.workTween) {
      avatar.workTween.stop();
      avatar.workTween = null;
      avatar.bodyGraphics.setScale(1);
    }
  }
}

class ThinkingState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('💭');
    avatar.startBreathingAnimation();
  }
}

class WaitingInputState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('⚠️');
    avatar.startBreathingAnimation();
    avatar.pulseTween = avatar.scene.tweens.add({
      targets: avatar.statusBubble,
      scale: 1.3,
      duration: 300,
      yoyo: true,
      repeat: -1
    });
  }
  exit(avatar) {
    if (avatar.pulseTween) {
      avatar.pulseTween.stop();
      avatar.pulseTween = null;
      avatar.statusBubble.setScale(1);
    }
  }
}

class RestingState extends State {
  enter(avatar) {
    avatar.statusBubble.setText('💤');
    avatar.setAlpha(0.85);
    avatar.startBreathingAnimation();
  }
  exit(avatar) {
    avatar.setAlpha(1.0);
  }
}

class DespawningState extends State {
  enter(avatar, doorCoordinates, onFinished) {
    avatar.statusBubble.setText('👋');
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
    this.assignedDesk = null;
    this.lastSimActivity = Date.now();
    
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
    this.setSize(36, 50);
    this.setInteractive(new Phaser.Geom.Rectangle(-18, -25, 36, 50), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => this.scene.events.emit('AGENT_CLICKED', this));
    this.on('pointerover', () => this.setScale(1.1));
    this.on('pointerout', () => this.setScale(1.0));

    scene.add.existing(this);
  }

  buildGraphics() {
    // 1. Sombra base
    const shadow = this.scene.add.ellipse(0, 16, 26, 12, 0x000000, 0.4);
    this.add(shadow);

    // 2. Cuerpo del avatar
    const roleColor = ROLE_COLORS[this.agentRole] || 0x38bdf8;
    this.bodyGraphics = this.scene.add.graphics();
    this.drawAvatarBody(roleColor);
    this.add(this.bodyGraphics);

    // 3. Etiqueta de Rol
    const labelText = ROLE_LABELS[this.agentRole] || this.agentRole.slice(0, 8);
    this.label = this.scene.add.text(0, -32, labelText, {
      fontSize: '10px',
      fontFamily: 'monospace',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: { x: 4, y: 1 }
    }).setOrigin(0.5);
    this.add(this.label);

    // 4. Icono de Estado (Bubble)
    this.statusBubble = this.scene.add.text(0, -48, '', {
      fontSize: '16px'
    }).setOrigin(0.5);
    this.add(this.statusBubble);
  }

  drawAvatarBody(color) {
    this.bodyGraphics.clear();
    // Torso base
    this.bodyGraphics.fillStyle(color, 1);
    this.bodyGraphics.fillRoundedRect(-10, -4, 20, 20, 4);
    // Cabeza
    this.bodyGraphics.fillStyle(0xfde047, 1);
    this.bodyGraphics.fillCircle(0, -12, 10);
    // TODO: Refinar sprites más adelante con texturas o spritesheets
  }

  startBreathingAnimation() {
    if (this.breathTween) return;
    this.breathTween = this.scene.tweens.add({
      targets: this.bodyGraphics,
      y: -2,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  stopBreathingAnimation() {
    if (this.breathTween) {
      this.breathTween.stop();
      this.breathTween = null;
      this.bodyGraphics.setY(0);
    }
  }

  // Interfaz pública para cambiar estados desde el Manager
  handleTelemetryState(telemetryState, simTime = null) {
    this.lastSimActivity = simTime || Date.now();
    this.pendingState = telemetryState;
    
    // Mapeo del estado del log al estado interno FSM
    switch (telemetryState) {
      case 'WORKING':
      case 'THINKING':
      case 'WAITING_INPUT':
        if (!this.assignedDesk) {
          this.assignedDesk = this.scene.getRandomDesk(this.agentRole);
          this.assignedLounge = null; // Clear lounge if they go back to work
        }
        
        // Si no estamos moviéndonos, verificar si estamos en el escritorio
        if (this.fsm.state !== 'MOVING') {
          const target = this.scene.gridToPx(this.assignedDesk.col, this.assignedDesk.row);
          if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) > 10) {
            // Moverse al escritorio y luego transicionar
            this.fsm.transition('MOVING', target.x, target.y, () => {
              const nextState = this.pendingState || telemetryState;
              this.pendingState = null;
              this.handleTelemetryState(nextState, this.lastSimActivity);
            });
          } else if (this.fsm.state !== telemetryState) {
            // Ya está ahí, cambiar estado directamente
            this.fsm.transition(telemetryState);
          }
        }
        break;

      case 'RESTING':
        // El Team Leader nunca descansa, ignora este estado y se mantiene trabajando/esperando
        if (this.agentRole === 'team_leader') return;

        if (!this.assignedLounge) {
          this.assignedLounge = this.scene.getRandomLoungeSpot();
          this.assignedDesk = null; // Clear desk
        }
        
        if (this.fsm.state !== 'MOVING') {
          const target = this.scene.gridToPx(this.assignedLounge.col, this.assignedLounge.row);
          if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) > 10) {
            this.fsm.transition('MOVING', target.x, target.y, () => {
              const nextState = this.pendingState || 'RESTING';
              this.pendingState = null;
              this.handleTelemetryState(nextState, this.lastSimActivity);
            });
          } else if (this.fsm.state !== 'RESTING') {
            this.fsm.transition('RESTING');
          }
        }
        break;
    }
  }

  moveTo(targetX, targetY, onComplete) {
    this.fsm.transition('MOVING', targetX, targetY, onComplete);
  }

  despawn(doorCoordinates, onFinished) {
    this.fsm.transition('DESPAWNING', doorCoordinates, onFinished);
  }

  destroy(fromScene) {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.bodyGraphics);
    if (this.statusBubble) this.scene.tweens.killTweensOf(this.statusBubble);
    super.destroy(fromScene);
  }
}
