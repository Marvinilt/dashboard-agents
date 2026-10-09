import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
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
const REAL_SESSIONS_DIR = path.resolve('../Conversaciones ejemplo');

const simulator = new SimulationEngine(io);
const liveWatcher = new LiveWatcher(io);

let activeMode = 'simulation'; // 'simulation' | 'live'
let currentSession = null;

// Helper para escanear sesiones
function scanSessions(baseDir, isMock = false) {
  if (!fs.existsSync(baseDir)) return [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  return entries
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      const sessionPath = path.join(baseDir, dirent.name);
      const transcriptPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
      let stats = null;
      let hasTranscript = false;
      if (fs.existsSync(transcriptPath)) {
        hasTranscript = true;
        stats = fs.statSync(transcriptPath);
      }
      return {
        id: dirent.name,
        name: isMock ? `[Mock] ${dirent.name.slice(0, 8)}...` : `[Sesión] ${dirent.name.slice(0, 8)}...`,
        path: sessionPath,
        hasTranscript,
        isMock,
        lastModified: stats ? stats.mtime : null,
        sizeBytes: stats ? stats.size : 0
      };
    })
    .filter(s => s.hasTranscript);
}

// Endpoint para listar sesiones disponibles
app.get('/api/sessions', (req, res) => {
  const mockSessions = scanSessions(MOCK_DATA_DIR, true);
  const realSessions = scanSessions(REAL_SESSIONS_DIR, false);
  res.json({
    activeMode,
    currentSession,
    status: simulator.getStatus(),
    sessions: [...mockSessions, ...realSessions]
  });
});

// Endpoint para seleccionar y arrancar una sesión
app.post('/api/sessions/select', async (req, res) => {
  const { sessionId, mode = 'simulation', speed = 3 } = req.body;
  const mockSessions = scanSessions(MOCK_DATA_DIR, true);
  const realSessions = scanSessions(REAL_SESSIONS_DIR, false);
  const allSessions = [...mockSessions, ...realSessions];

  const target = allSessions.find(s => s.id === sessionId);
  if (!target) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }

  activeMode = mode;
  currentSession = target;

  // Notificar al frontend que se reinicie la oficina para la nueva sesión
  io.emit('SESSION_CHANGED', {
    sessionId: target.id,
    mode: activeMode,
    sessionName: target.name
  });

  if (activeMode === 'simulation') {
    liveWatcher.stop();
    simulator.setSpeed(speed);
    try {
      const eventCount = await simulator.loadSession(target.path, target.id);
      simulator.start();
      res.json({ success: true, mode: 'simulation', eventCount, sessionId: target.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    simulator.stop();
    liveWatcher.start(target.path, target.id);
    res.json({ success: true, mode: 'live', sessionId: target.id });
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

  // Permitir al usuario enviar un input de respuesta si un agente está en WAITING_INPUT
  socket.on('USER_RESPONSE_INPUT', (payload) => {
    console.log(`[Socket] Input del usuario para agente ${payload.agentId}:`, payload.input);
    // Reemitir al sistema o guardarlo
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
