import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chokidar from 'chokidar';
import { parseTranscriptLine } from './parser.js';

export class LiveWatcher {
  constructor(io) {
    this.io = io;
    this.watcher = null;
    this.currentSessionId = null;
    this.currentFilePath = null;
    this.processedLines = 0;
  }

  start(sessionPath, sessionId) {
    this.stop();
    this.currentSessionId = sessionId;
    this.currentFilePath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
    this.processedLines = 0;

    if (!fs.existsSync(this.currentFilePath)) {
      console.warn(`[Watcher] El archivo ${this.currentFilePath} aún no existe, observando directorio.`);
    } else {
      // Contar líneas iniciales para no duplicar si queremos procesar en vivo
      this.catchUpExisting();
    }

    this.watcher = chokidar.watch(this.currentFilePath, {
      persistent: true,
      usePolling: true,
      interval: 400
    });

    this.watcher.on('change', async () => {
      await this.readNewLines();
    });

    console.log(`[Watcher] Observando en vivo sesión "${sessionId}" en: ${this.currentFilePath}`);
  }

  async catchUpExisting() {
    if (!fs.existsSync(this.currentFilePath)) return;
    const fileStream = fs.createReadStream(this.currentFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
      this.processedLines++;
      const evt = parseTranscriptLine(line, this.currentSessionId);
      if (evt) {
        this.io.emit('AGENT_EVENT', evt);
      }
    }
  }

  async readNewLines() {
    if (!fs.existsSync(this.currentFilePath)) return;
    const fileStream = fs.createReadStream(this.currentFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let currentLine = 0;

    for await (const line of rl) {
      currentLine++;
      if (currentLine > this.processedLines) {
        this.processedLines = currentLine;
        const parsed = parseTranscriptLine(line, this.currentSessionId);
        if (parsed) {
          this.io.emit('AGENT_EVENT', parsed);
        }
      }
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

