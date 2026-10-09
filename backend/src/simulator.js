import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { parseTranscriptLine } from './parser.js';

export class SimulationEngine {
  constructor(io, options = {}) {
    this.io = io;
    this.speed = options.speed || 3.0; // Factor de aceleración por defecto (3x)
    this.activeTimer = null;
    this.isRunning = false;
    this.currentSessionId = null;
    this.eventsQueue = [];
    this.currentIndex = 0;
  }

  setSpeed(speed) {
    this.speed = Math.max(0.2, Math.min(20, Number(speed) || 1));
    console.log(`[Simulator] Velocidad ajustada a ${this.speed}x`);
  }

  async loadSession(sessionPath, sessionId) {
    this.stop();
    this.currentSessionId = sessionId;
    this.eventsQueue = [];
    this.currentIndex = 0;

    const transcriptPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(transcriptPath)) {
      throw new Error(`No se encontró transcript.jsonl en ${transcriptPath}`);
    }

    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const parsed = parseTranscriptLine(line, sessionId);
      if (parsed) {
        this.eventsQueue.push(parsed);
      }
    }

    console.log(`[Simulator] Sesión "${sessionId}" cargada con ${this.eventsQueue.length} eventos.`);
    return this.eventsQueue.length;
  }

  start() {
    if (this.isRunning || this.eventsQueue.length === 0) return;
    this.isRunning = true;
    console.log(`[Simulator] Iniciando reproducción para sesión "${this.currentSessionId}" a ${this.speed}x...`);
    this.scheduleNext();
  }

  stop() {
    this.isRunning = false;
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
  }

  scheduleNext() {
    if (!this.isRunning || this.currentIndex >= this.eventsQueue.length) {
      this.isRunning = false;
      this.io.emit('SIMULATION_COMPLETED', {
        sessionId: this.currentSessionId,
        totalEvents: this.eventsQueue.length
      });
      console.log(`[Simulator] Simulación completada para sesión "${this.currentSessionId}".`);
      return;
    }

    const currentEvent = this.eventsQueue[this.currentIndex];
    const nextEvent = this.eventsQueue[this.currentIndex + 1];

    // Emitir el evento actual
    this.io.emit('AGENT_EVENT', currentEvent);
    this.currentIndex++;

    // Calcular retardo realista entre eventos con base en timestamp o fallback
    let delayMs = 1200; // default 1.2s
    if (nextEvent && currentEvent.timestamp && nextEvent.timestamp) {
      const t1 = new Date(currentEvent.timestamp).getTime();
      const t2 = new Date(nextEvent.timestamp).getTime();
      const diff = t2 - t1;
      if (!isNaN(diff) && diff >= 0) {
        // Acotar entre 300ms y 6000ms en tiempo real antes de aplicar aceleración
        const bounded = Math.max(300, Math.min(diff, 6000));
        delayMs = bounded / this.speed;
      }
    } else {
      delayMs = delayMs / this.speed;
    }

    this.activeTimer = setTimeout(() => {
      this.scheduleNext();
    }, delayMs);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.currentSessionId,
      progress: this.eventsQueue.length > 0 ? (this.currentIndex / this.eventsQueue.length) : 0,
      currentIndex: this.currentIndex,
      totalEvents: this.eventsQueue.length,
      speed: this.speed
    };
  }
}
