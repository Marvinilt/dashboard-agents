import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chokidar from 'chokidar';
import { parseTranscriptLine } from './parser.js';
import os from 'os';

const DEFAULT_BRAIN_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

export class LiveWatcher {
  constructor(io) {
    this.io = io;
    this.watchers = new Map();
    this.processedLinesMap = new Map();
    this.uuidToRoleMap = new Map();
    this.pendingSubagents = [];
    this.currentSessionId = null;
    this.sessionPath = null;
  }

  start(sessionPath, sessionId) {
    this.stop();
    this.currentSessionId = sessionId;
    this.sessionPath = sessionPath;

    const mainTranscript = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
    this.watchTranscript(mainTranscript, { agentId: 'team_leader', agentRole: 'team_leader', agentName: 'Team Leader' });
    console.log(`[Watcher] Observando en vivo sesión "${sessionId}"`);
  }

  watchTranscript(filePath, agentInfo) {
    if (this.watchers.has(filePath)) return;

    this.processedLinesMap.set(filePath, 0);

    if (!fs.existsSync(filePath)) {
      console.warn(`[Watcher] El archivo ${filePath} aún no existe, observando directorio.`);
    } else {
      this.catchUpExisting(filePath, agentInfo);
    }

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      usePolling: true,
      interval: 400
    });

    watcher.on('change', async () => {
      await this.readNewLines(filePath, agentInfo);
    });

    this.watchers.set(filePath, watcher);
    console.log(`[Watcher] Instancia de chokidar iniciada para: ${filePath}`);
  }

  emitEventWithSubagents(evt) {
    this.io.emit('AGENT_EVENT', evt);
    
    if (evt.eventType === 'AGENT_SPAWNED' && evt.metadata?.invokedSubagents?.length > 0) {
      evt.metadata.invokedSubagents.forEach((sub, sIdx) => {
        this.pendingSubagents.push(sub);
        
        const subEvent = {
          eventId: `spawn_${sub.id}_${Date.now()}_${sIdx}`,
          stepIndex: evt.stepIndex,
          timestamp: evt.timestamp,
          agentId: sub.id,
          agentRole: sub.role,
          agentName: sub.name,
          state: 'SPAWNING',
          eventType: 'AGENT_SPAWNED',
          metadata: {
            detailMessage: `Subagente ${sub.name} asignado al proyecto.`
          }
        };
        setTimeout(() => {
          this.io.emit('AGENT_EVENT', subEvent);
        }, 120 * (sIdx + 1));
      });
    }

    if (evt.eventType === 'SUBAGENT_CREATED') {
      let subsToProcess = [];
      if (evt.metadata?.toolArgs?.createdSubagents) {
        subsToProcess = evt.metadata.toolArgs.createdSubagents;
      } else if (evt.metadata?.toolArgs?.conversationId) {
        subsToProcess = [evt.metadata.toolArgs];
      }

      subsToProcess.forEach(subData => {
        const uuid = subData.conversationId;
        const logUri = subData.logAbsoluteUri;
        
        const mappedSubagent = this.pendingSubagents.shift();
        const subAgentInfo = mappedSubagent ? {
          agentId: mappedSubagent.id,
          agentRole: mappedSubagent.role,
          agentName: mappedSubagent.name
        } : { agentId: uuid, agentRole: 'developer', agentName: 'Desarrollador' };
        
        if (uuid) {
          this.uuidToRoleMap.set(uuid, subAgentInfo);
        }
        
        let subagentPath = null;
        if (logUri && logUri.startsWith('file:///')) {
          let uriPath = logUri.replace('file:///', '');
          uriPath = decodeURIComponent(uriPath);
          uriPath = uriPath.split('/').join(path.sep);
          subagentPath = uriPath.replace('transcript_full.jsonl', 'transcript.jsonl');
        } else if (uuid) {
          subagentPath = path.join(DEFAULT_BRAIN_DIR, uuid, '.system_generated', 'logs', 'transcript.jsonl');
        }

        if (subagentPath) {
          this.watchTranscript(subagentPath, subAgentInfo);
        }
      });
    }
  }

  async catchUpExisting(filePath, agentInfo) {
    if (!fs.existsSync(filePath)) return;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let lines = 0;
    for await (const line of rl) {
      lines++;
      const evt = parseTranscriptLine(line, { ...agentInfo, subagentsByUuid: this.uuidToRoleMap });
      if (evt) {
        this.emitEventWithSubagents(evt);
      }
    }
    this.processedLinesMap.set(filePath, lines);
  }

  async readNewLines(filePath, agentInfo) {
    if (!fs.existsSync(filePath)) return;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let currentLine = 0;
    const processedLines = this.processedLinesMap.get(filePath) || 0;

    for await (const line of rl) {
      currentLine++;
      if (currentLine > processedLines) {
        this.processedLinesMap.set(filePath, currentLine);
        const parsed = parseTranscriptLine(line, { ...agentInfo, subagentsByUuid: this.uuidToRoleMap });
        if (parsed) {
          this.emitEventWithSubagents(parsed);
        }
      }
    }
  }

  stop() {
    for (const [filePath, watcher] of this.watchers.entries()) {
      watcher.close();
    }
    this.watchers.clear();
    this.processedLinesMap.clear();
    this.uuidToRoleMap.clear();
    this.pendingSubagents = [];
  }
}
