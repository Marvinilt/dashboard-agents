import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { parseTranscriptLine } from './parser.js';
import os from 'os';

const DEFAULT_BRAIN_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

export class SimulationEngine {
  constructor(io, options = {}) {
    this.io = io;
    this.speed = options.speed || 3.0; // Factor de aceleración por defecto (3x)
    this.activeTimer = null;
    this.isRunning = false;
    this.currentSessionId = null;
    this.eventsQueue = [];
    this.currentIndex = 0;
    this.pendingSubagents = [];
    this.subagentsByUuid = new Map();
  }

  setSpeed(speed) {
    this.speed = Math.max(0.2, Math.min(20, Number(speed) || 1));
    console.log(`[Simulator] Velocidad ajustada a ${this.speed}x`);
  }

  async loadTranscript(transcriptPath, agentInfo) {
    if (!fs.existsSync(transcriptPath)) {
      console.warn(`[Simulator] No se encontró transcript en ${transcriptPath}`);
      return;
    }

    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const subagentLoadPromises = [];

    for await (const line of rl) {
      const parsed = parseTranscriptLine(line, { ...agentInfo, subagentsByUuid: this.subagentsByUuid });
      if (parsed) {
        this.eventsQueue.push(parsed);

        // Queue para tracking de subagentes
        if (parsed.state === 'ERROR') {
            this.pendingSubagents = [];
          }
          
          // Queue para tracking de subagentes
          if (parsed.eventType === 'AGENT_SPAWNED' && parsed.metadata?.invokedSubagents?.length > 0) {
          parsed.metadata.invokedSubagents.forEach((sub, sIdx) => {
            console.log('[Simulator] Pushing subagent to queue:', sub); this.pendingSubagents.push(sub);
            
            // Generar evento de SPAWNING para el subagente y agregarlo a la cola
            const subEvent = {
              eventId: `spawn_${sub.id}_${Date.now()}_${sIdx}`,
              stepIndex: parsed.stepIndex,
              timestamp: new Date(new Date(parsed.timestamp).getTime() + (sIdx + 1)).toISOString(),
              agentId: sub.id,
              agentRole: sub.role,
              agentName: sub.name,
              state: 'SPAWNING',
              eventType: 'AGENT_SPAWNED',
              metadata: {
                detailMessage: `Subagente ${sub.name} asignado al proyecto.`
              }
            };
            this.eventsQueue.push(subEvent);
          });
        }

        // Descubierto subagente, cargar su archivo!
        if (parsed.eventType === 'SUBAGENT_CREATED') {
          let subsToProcess = [];
          if (parsed.metadata?.toolArgs?.createdSubagents) {
            subsToProcess = parsed.metadata.toolArgs.createdSubagents;
          } else if (parsed.metadata?.toolArgs?.conversationId) {
            subsToProcess = [parsed.metadata.toolArgs];
          }
          
          subsToProcess.forEach(subData => {
            const uuid = subData.conversationId;
            const logUri = subData.logAbsoluteUri;
            
            const mappedSubagent = this.pendingSubagents.shift(); console.log('[Simulator] Shifted from queue:', mappedSubagent);
            const subAgentInfo = mappedSubagent ? {
              agentId: mappedSubagent.id,
              agentRole: mappedSubagent.role,
              agentName: mappedSubagent.name
            } : { agentId: uuid, agentRole: 'developer', agentName: 'Desarrollador' };

            if (uuid) {
              this.subagentsByUuid.set(uuid, subAgentInfo);
            }
  
            let subagentPath = null;
            if (logUri && logUri.startsWith('file:///')) {
              let uriPath = logUri.replace('file:///', '');
              uriPath = decodeURIComponent(uriPath);
              uriPath = uriPath.split('/').join(path.sep);
              subagentPath = uriPath.replace('transcript_full.jsonl', 'transcript.jsonl');
            } else {
              subagentPath = path.join(DEFAULT_BRAIN_DIR, uuid, '.system_generated', 'logs', 'transcript.jsonl');
            }
            console.log('[Simulator] Cargando subagente:', subAgentInfo, subagentPath);
            subagentLoadPromises.push(this.loadTranscript(subagentPath, subAgentInfo));
          });
        }
      }
    }

    // Esperar a que todos los subagentes (recursivos) de este transcript terminen de cargar
    await Promise.all(subagentLoadPromises);
  }

  async loadSession(sessionPath, sessionId) {
    this.stop();
    this.currentSessionId = sessionId;
    this.eventsQueue = [];
    this.currentIndex = 0;
    this.pendingSubagents = [];
    this.subagentsByUuid = new Map();

    const mainTranscript = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
    
    console.log(`[Simulator] Iniciando carga de sesión y subagentes para "${sessionId}"...`);
    
    await this.loadTranscript(mainTranscript, { agentId: 'team_leader', agentRole: 'team_leader', agentName: 'Team Leader' });

    // Ordenar globalmente todos los eventos de todos los agentes por timestamp
    this.eventsQueue.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`[Simulator] Sesión "${sessionId}" cargada con ${this.eventsQueue.length} eventos totales (Orquestador + Subagentes).`);
    return this.eventsQueue.length;
  }

  start() {
    if (this.isRunning || this.eventsQueue.length === 0) return;
    
    // Si llegó al final y le damos play, reinicia desde cero automáticamente
    if (this.currentIndex >= this.eventsQueue.length) {
      this.jumpToIndex(0);
    }
    
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

    this.io.emit('AGENT_EVENT', {
      ...currentEvent,
      _simulatorStatus: {
        currentIndex: this.currentIndex,
        totalEvents: this.eventsQueue.length
      }
    });

    this.currentIndex++;

    let delayMs = 1200;
    if (nextEvent && currentEvent.timestamp && nextEvent.timestamp) {
      const t1 = new Date(currentEvent.timestamp).getTime();
      const t2 = new Date(nextEvent.timestamp).getTime();
      const diff = t2 - t1;
      if (!isNaN(diff) && diff >= 0) {
        // En una simulación multi-agente los eventos concurrentes pueden tener diff 0 o muy corto.
        // Aplicamos un pequeño delay base para que la interfaz alcance a animar
        const bounded = Math.max(100, Math.min(diff, 5000));
        delayMs = bounded / this.speed;
      }
    } else {
      delayMs = delayMs / this.speed;
    }

    this.activeTimer = setTimeout(() => {
      this.scheduleNext();
    }, delayMs);
  }

  jumpToIndex(index) {
    this.stop();
    this.currentIndex = Math.max(0, Math.min(index, this.eventsQueue.length - 1));
    
    // Calcular el estado final de cada agente hasta el index seleccionado
    const lastEventsByAgent = {};
    const stats = {};
    let blockedCount = 0;
    
    for (let i = 0; i <= this.currentIndex; i++) {
      const ev = this.eventsQueue[i];
      if (ev && ev.agentId) {
        lastEventsByAgent[ev.agentId] = ev;
        if (!stats[ev.agentId]) {
          stats[ev.agentId] = { startTime: ev.timestamp, count: 0, agentRole: ev.agentRole || 'Subagente' };
        }
        stats[ev.agentId].count++;
        stats[ev.agentId].agentRole = ev.agentRole || stats[ev.agentId].agentRole;
        stats[ev.agentId].state = ev.state || stats[ev.agentId].state;
      }
    }
    
    // Recalcular blockedCount basado en el estado final
    Object.values(stats).forEach(s => {
      if (s.state === 'WAITING_INPUT') blockedCount++;
    });
    const logsSlice = this.eventsQueue.slice(Math.max(0, this.currentIndex - 500 + 1), this.currentIndex + 1);

    this.io.emit('SIMULATION_JUMPED', {
      currentIndex: this.currentIndex,
      totalEvents: this.currentIndex + 1, // Para actualizar metrics
      blockedCount,
      logsSlice,
      stats,
      lastEventsByAgent,
      timestamp: this.eventsQueue[this.currentIndex]?.timestamp || null
    });
    
    console.log(`[Simulator] Simulación movida al evento índice ${this.currentIndex}`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.currentSessionId,
      progress: this.eventsQueue.length > 0 ? (this.currentIndex / this.eventsQueue.length) : 0,
      currentIndex: this.currentIndex,
      totalEvents: this.eventsQueue.length,
      speed: this.speed,
      currentTimestamp: this.eventsQueue[this.currentIndex]?.timestamp || null
    };
  }
}




