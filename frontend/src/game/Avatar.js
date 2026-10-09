import Phaser from 'phaser';

const ROLE_COLORS = {
  software_engineer: 0x38bdf8, // Azul cyan / Hacker
  documenter: 0xa855f7,       // Púrpura / Redactor
  qa_tester: 0x22c55e,        // Verde / Tester
  dba_architect: 0xf59e0b,    // Ámbar / DBA
  planner: 0xec4899           // Rosa / Team lead
};

export class Avatar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, agentId, agentRole = 'software_engineer') {
    super(scene, x, y);
    this.scene = scene;
    this.agentId = agentId;
    this.agentRole = agentRole;
    this.state = 'SPAWNING'; // SPAWNING, WORKING, THINKING, WAITING_INPUT, RESTING, DESPAWNING
    this.assignedDesk = null;
    this.lastActivity = Date.now();

    // 1. Base sombra
    const shadow = scene.add.ellipse(0, 16, 26, 12, 0x000000, 0.4);
    this.add(shadow);

    // 2. Cuerpo del avatar estilo gaming
    const roleColor = ROLE_COLORS[agentRole] || 0x38bdf8;
    this.bodyGraphics = scene.add.graphics();
    this.drawAvatarBody(roleColor);
    this.add(this.bodyGraphics);

    // 3. Etiqueta con nombre o rol
    const labelText = agentRole.slice(0, 8);
    this.label = scene.add.text(0, -32, labelText, {
      fontSize: '10px',
      fontFamily: 'monospace',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5);
    this.add(this.label);

    // 4. Indicador de estado flotante (Burbuja o engranaje o Zzz)
    this.statusBubble = scene.add.text(0, -48, '', {
      fontSize: '16px'
    }).setOrigin(0.5);
    this.add(this.statusBubble);

    // Interacción de clic
    this.setSize(36, 50);
    this.setInteractive(new Phaser.Geom.Rectangle(-18, -25, 36, 50), Phaser.Geom.Rectangle.Contains);

    this.on('pointerdown', () => {
      this.scene.events.emit('AGENT_CLICKED', this);
    });

    this.on('pointerover', () => {
      this.setScale(1.1);
    });

    this.on('pointerout', () => {
      this.setScale(1.0);
    });

    scene.add.existing(this);
    this.startBreathingAnimation();
  }

  drawAvatarBody(color) {
    this.bodyGraphics.clear();
    // Torso / Ropa
    this.bodyGraphics.fillStyle(color, 1);
    this.bodyGraphics.fillRoundedRect(-10, -4, 20, 20, 4);

    // Cabeza
    this.bodyGraphics.fillStyle(0xfde047, 1); // Piel / Cara estilizada
    this.bodyGraphics.fillCircle(0, -12, 10);

    // Gafas o auriculares según rol
    if (this.agentRole === 'software_engineer') {
      this.bodyGraphics.fillStyle(0x0f172a, 1);
      this.bodyGraphics.fillRect(-12, -16, 24, 4); // Auriculares
    } else if (this.agentRole === 'qa_tester') {
      this.bodyGraphics.lineStyle(1, 0x15803d, 1);
      this.bodyGraphics.strokeCircle(-4, -12, 3); // Lentes
      this.bodyGraphics.strokeCircle(4, -12, 3);
    }
  }

  startBreathingAnimation() {
    this.scene.tweens.add({
      targets: this.bodyGraphics,
      y: -2,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  walkTo(targetX, targetY, onComplete) {
    // Animación de caminata / balanceo
    const walkTween = this.scene.tweens.add({
      targets: this,
      rotation: 0.1,
      duration: 150,
      yoyo: true,
      repeat: -1
    });

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 1400,
      ease: 'Power1',
      onComplete: () => {
        walkTween.stop();
        this.setRotation(0);
        if (onComplete) onComplete();
      }
    });
  }

  setState(newState, detail = '') {
    this.state = newState;
    this.lastActivity = Date.now();

    switch (newState) {
      case 'WORKING':
        this.statusBubble.setText('⚡');
        this.setAlpha(1.0);
        break;
      case 'THINKING':
        this.statusBubble.setText('💭');
        this.setAlpha(1.0);
        break;
      case 'WAITING_INPUT':
        this.statusBubble.setText('❗');
        // Efecto pulso de urgencia
        this.scene.tweens.add({
          targets: this.statusBubble,
          scale: 1.4,
          duration: 300,
          yoyo: true,
          repeat: -1
        });
        break;
      case 'RESTING':
        this.statusBubble.setText('☕');
        this.setAlpha(0.85);
        break;
      case 'ERROR':
        this.statusBubble.setText('🔥');
        break;
      case 'DESPAWNING':
        this.statusBubble.setText('👋');
        break;
      default:
        this.statusBubble.setText('');
    }
  }

  despawn(doorCoordinates, onFinished) {
    this.setState('DESPAWNING');
    this.walkTo(doorCoordinates.x, doorCoordinates.y, () => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scale: 0.2,
        duration: 500,
        onComplete: () => {
          if (this.assignedDesk) {
            this.assignedDesk.isOccupied = false;
            this.assignedDesk = null;
          }
          this.destroy();
          if (onFinished) onFinished();
        }
      });
    });
  }
}

