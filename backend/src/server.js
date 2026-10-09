import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SimulationEngine } from './simulator.js';
import { LiveWatcher } from './watcher.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MOCK_DATA_DIR = path.resolve('mock_data');
const SAMPLES_DIR = path.resolve('../Conversaciones ejemplo');
const DEFAULT_BRAIN_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

const simulator = new SimulationEngine(io);
const liveWatcher = new LiveWatcher(io);

let activeMode = 'simulation'; // 'simulation' | 'live'
let currentSession = null;
let customDirectory = fs.existsSync(DEFAULT_BRAIN_DIR) ? DEFAULT_BRAIN_DIR : null;

// Helper para escanear sesiones recursivamente o en primer nivel
function scanDirectoryForSessions(baseDir, sourceTag = 'Carpeta') {
  if (!baseDir || !fs.existsSync(baseDir)) return [];
  const results = [];

  try {
    // 1. Verificar si la carpeta actual es directamente una sesión (contiene transcript.jsonl)
    const directTranscript = path.join(baseDir, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(directTranscript)) {
      const stats = fs.statSync(directTranscript);
      results.push({
        id: path.basename(baseDir),
        name: `[${sourceTag}] ${path.basename(baseDir)}`,
        path: baseDir,
        hasTranscript: true,
        source: sourceTag,
        lastModified: stats.mtime,
        sizeBytes: stats.size
      });
      return results;
    }

    // 2. Si es una carpeta contenedora de sesiones (ej: brain o Conversaciones ejemplo)
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const dirent of entries) {
      if (dirent.isDirectory()) {
        const sessionPath = path.join(baseDir, dirent.name);
        const transcriptPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          const stats = fs.statSync(transcriptPath);
          results.push({
            id: dirent.name,
            name: `[${sourceTag}] ${dirent.name}`,
            path: sessionPath,
            hasTranscript: true,
            source: sourceTag,
            lastModified: stats.mtime,
            sizeBytes: stats.size
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error escaneando directorio ${baseDir}:`, err.message);
  }

  return results;
}

// Endpoint para listar sesiones disponibles ordenadas por fecha reciente
app.get('/api/sessions', (req, res) => {
  const mockSessions = scanDirectoryForSessions(MOCK_DATA_DIR, 'Mock');
  const sampleSessions = scanDirectoryForSessions(SAMPLES_DIR, 'Ejemplos');
  const customSessions = customDirectory ? scanDirectoryForSessions(customDirectory, 'Brain') : [];

  // Unificar sesiones evitando duplicados por ruta
  const sessionsMap = new Map();
  [...customSessions, ...sampleSessions, ...mockSessions].forEach((sess) => {
    if (!sessionsMap.has(sess.path)) {
      sessionsMap.set(sess.path, sess);
    }
  });

  const allSessions = Array.from(sessionsMap.values());

  // Ordenar de más reciente a más antigua
  allSessions.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  res.json({
    activeMode,
    currentSession,
    customDirectory,
    defaultBrainDir: fs.existsSync(DEFAULT_BRAIN_DIR) ? DEFAULT_BRAIN_DIR : null,
    status: simulator.getStatus(),
    sessions: allSessions
  });
});

// Endpoint para configurar o escanear una carpeta personalizada del sistema
app.post('/api/sessions/set-directory', (req, res) => {
  const { directoryPath } = req.body;
  if (!directoryPath || !fs.existsSync(directoryPath)) {
    return res.status(400).json({ error: 'La ruta especificada no existe o no es accesible.' });
  }

  customDirectory = path.resolve(directoryPath);
  const foundSessions = scanDirectoryForSessions(customDirectory, 'Explorador');
  console.log(`[Directory] Carpeta personalizada establecida: ${customDirectory} (${foundSessions.length} sesiones detectadas)`);

  res.json({
    success: true,
    customDirectory,
    sessionsFound: foundSessions.length
  });
});

// Endpoint para seleccionar y arrancar una sesión
app.post('/api/sessions/select', async (req, res) => {
  const { sessionId, sessionPath, mode = 'simulation', speed = 3 } = req.body;

  // Re-escanear todo para encontrar la sesión solicitada
  const mockSessions = scanDirectoryForSessions(MOCK_DATA_DIR, 'Mock');
  const sampleSessions = scanDirectoryForSessions(SAMPLES_DIR, 'Ejemplos');
  const customSessions = customDirectory ? scanDirectoryForSessions(customDirectory, 'Brain') : [];
  const allSessions = [...customSessions, ...sampleSessions, ...mockSessions];

  let target = null;
  if (sessionPath) {
    target = allSessions.find(s => s.path === sessionPath);
  }
  if (!target && sessionId) {
    target = allSessions.find(s => s.id === sessionId);
  }

  // Si se pasa una ruta manual no listada previamente
  if (!target && sessionPath && fs.existsSync(sessionPath)) {
    const transcriptPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(transcriptPath)) {
      const stats = fs.statSync(transcriptPath);
      target = {
        id: path.basename(sessionPath),
        name: `[Manual] ${path.basename(sessionPath)}`,
        path: sessionPath,
        hasTranscript: true,
        lastModified: stats.mtime,
        sizeBytes: stats.size
      };
    }
  }

  if (!target) {
    return res.status(404).json({ error: 'Sesión o ruta no encontrada' });
  }

  activeMode = mode;
  currentSession = target;

  // Notificar al frontend que se reinicie la oficina para la nueva sesión
  io.emit('SESSION_CHANGED', {
    sessionId: target.id,
    sessionPath: target.path,
    mode: activeMode,
    sessionName: target.name
  });

  if (activeMode === 'simulation') {
    liveWatcher.stop();
    simulator.setSpeed(speed);
    try {
      const eventCount = await simulator.loadSession(target.path, target.id);
      simulator.start();
      res.json({ success: true, mode: 'simulation', eventCount, sessionId: target.id, target });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    simulator.stop();
    liveWatcher.start(target.path, target.id);
    res.json({ success: true, mode: 'live', sessionId: target.id, target });
  }
});

// Endpoint para controlar reproducción
app.post('/api/simulator/control', (req, res) => {
  const { action, speed } = req.body;
  if (action === 'pause') {
    simulator.stop();
  } else if (action === 'play') {
    simulator.start();
  } else if (action === 'speed' && speed) {
    simulator.setSpeed(speed);
  }
  res.json({ success: true, status: simulator.getStatus() });
});

// WebSockets
io.on('connection', (socket) => {
  console.log(`[Socket] Cliente conectado: ${socket.id}`);
  socket.emit('SERVER_READY', {
    activeMode,
    currentSession,
    simulatorStatus: simulator.getStatus()
  });

  socket.on('USER_RESPONSE_INPUT', (payload) => {
    console.log(`[Socket] Input del usuario para agente ${payload.agentId}:`, payload.input);
    io.emit('AGENT_EVENT', {
      eventId: `user_input_${Date.now()}`,
      agentId: payload.agentId,
      agentRole: payload.agentRole || 'software_engineer',
      state: 'WORKING',
      eventType: 'USER_INPUT_RECEIVED',
      metadata: {
        detailMessage: `Usuario respondió: ${payload.input}`
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Dashboard Agents Backend corriendo en http://localhost:${PORT}`);
});
