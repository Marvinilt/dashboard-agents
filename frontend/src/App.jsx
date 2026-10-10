import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { PhaserGame } from './components/PhaserGame';
import { SessionSelector } from './components/SessionSelector';
import { AgentSidebar } from './components/AgentSidebar';
import { Bot, Activity, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001';

export function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [customDirectory, setCustomDirectory] = useState('');
  const [mode, setMode] = useState('simulation');
  const [speed, setSpeed] = useState(3);
  const [simStatus, setSimStatus] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [agentStats, setAgentStats] = useState({});
  const [metrics, setMetrics] = useState({
    activeAgents: 0,
    blockedCount: 0,
    totalEvents: 0
  });

  const socketRef = useRef(null);
  const officeSceneRef = useRef(null);

  // 1. Inicializar conexión WebSockets y cargar lista de sesiones
  useEffect(() => {
    fetchSessions();

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[React] Conectado al backend WebSockets');
    });

    socket.on('AGENT_EVENT', (event) => {
      setTelemetryLogs((prev) => [...prev.slice(-100), event]);

      if (officeSceneRef.current) {
        officeSceneRef.current.handleTelemetryEvent(event);
      }

      setMetrics((prev) => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
        blockedCount: event.state === 'WAITING_INPUT' ? prev.blockedCount + 1 : prev.blockedCount
      }));

      if (event._simulatorStatus) {
        setSimStatus(prev => prev ? {
          ...prev,
          currentIndex: event._simulatorStatus.currentIndex,
          totalEvents: event._simulatorStatus.totalEvents,
          currentTimestamp: event.timestamp,
          progress: event._simulatorStatus.totalEvents > 0 ? event._simulatorStatus.currentIndex / event._simulatorStatus.totalEvents : 0
        } : prev);
      }

      setAgentStats((prev) => {
        const current = prev[event.agentId] || { startTime: event.timestamp, count: 0 };
        return {
          ...prev,
          [event.agentId]: {
            startTime: current.startTime || event.timestamp,
            count: current.count + 1,
            agentRole: event.agentRole || current.agentRole || 'Subagente',
            state: event.state || current.state || 'WORKING'
          }
        };
      });

      setSelectedAgent((current) => {
        if (current && current.agentId === event.agentId) {
          return {
            ...current,
            state: event.state,
            agentRole: event.agentRole || current.agentRole
          };
        }
        return current;
      });
    });

    socket.on('SIMULATION_JUMPED', (data) => {
      console.log(`[React] Simulación saltó al índice ${data.currentIndex}`);
      if (officeSceneRef.current) {
        officeSceneRef.current.resetOffice();
        if (data.timestamp) {
          officeSceneRef.current.currentSimTime = new Date(data.timestamp).getTime();
        }
        Object.values(data.lastEventsByAgent).forEach(event => {
          officeSceneRef.current.handleTelemetryEvent(event, true);
        });
        officeSceneRef.current.checkInactivityLifecycle();
      }
      setTelemetryLogs(data.logsSlice);
      setAgentStats(data.stats);
      setMetrics((prev) => ({
        ...prev,
        totalEvents: data.totalEvents,
        blockedCount: data.blockedCount
      }));
      setSimStatus(prev => prev ? { 
        ...prev, 
        currentIndex: data.currentIndex, 
        currentTimestamp: data.timestamp, 
        progress: data.totalEvents > 0 ? data.currentIndex / data.totalEvents : 0 
      } : prev);
    });

    socket.on('SESSION_CHANGED', ({ sessionId }) => {
      console.log(`[React] Cambio de sesión detectado a: ${sessionId}`);
      if (officeSceneRef.current) {
        officeSceneRef.current.resetOffice();
      }
      setTelemetryLogs([]);
      setAgentStats({});
      setSelectedAgent(null);
    });

    socket.on('SIMULATION_COMPLETED', (data) => {
      console.log(`[React] Simulación completada para: ${data.sessionId}`);
      setSimStatus(prev => prev ? {
        ...prev,
        isRunning: false,
        currentIndex: data.totalEvents
      } : prev);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setSimStatus(data.status);
      if (data.customDirectory) {
        setCustomDirectory(data.customDirectory);
      }
      if (data.sessions?.length > 0 && !selectedSessionId) {
        handleSelectSession(data.sessions[0].id, data.sessions[0].path);
      }
    } catch (err) {
      console.error('Error cargando sesiones:', err);
    }
  };

  const handleSelectSession = async (sessionId, sessionPath = null) => {
    setSelectedSessionId(sessionId);
    const targetSession = sessions.find(s => s.id === sessionId) || (sessionPath ? { path: sessionPath } : null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionPath: targetSession?.path,
          mode,
          speed
        })
      });
      const data = await res.json();
      if (data.status) {
        setSimStatus(data.status);
      }
      
      if (officeSceneRef.current) {
        officeSceneRef.current.resetOffice();
      }
      setTelemetryLogs([]);
    } catch (err) {
      console.error('Error al cambiar sesión:', err);
    }
  };

  const handleSetCustomDirectory = async (directoryPath) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/set-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryPath })
      });
      const data = await res.json();
      if (data.success) {
        setCustomDirectory(data.customDirectory);
        await fetchSessions();
      } else {
        alert(data.error || 'No se pudo explorar la carpeta.');
      }
    } catch (err) {
      console.error('Error escaneando directorio personalizado:', err);
      alert('Error al acceder al directorio indicado.');
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (selectedSessionId) {
      handleSelectSession(selectedSessionId);
    }
  };

  const handleControlSimulator = async (action, payload = {}) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/simulator/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await res.json();
      setSimStatus(data.status);
    } catch (err) {
      console.error('Error controlando simulador:', err);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    try {
      await fetch(`${BACKEND_URL}/api/simulator/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speed', speed: newSpeed })
      });
    } catch (err) {
      console.error('Error cambiando velocidad:', err);
    }
  };

  const handleSendResponse = (agentId, input) => {
    if (socketRef.current) {
      socketRef.current.emit('USER_RESPONSE_INPUT', {
        agentId,
        input,
        agentRole: selectedAgent?.agentRole
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 space-y-6">
      {/* Top Navbar / HUD Corporativo Gaming */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Agent Virtual HQ
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                v1.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Observabilidad gamificada en tiempo real para orquestadores multi-agente
            </p>
          </div>
        </div>

        {/* Mini Contadores HUD */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
            <Activity className="w-4 h-4 text-sky-400" />
            <span className="text-slate-400">Eventos:</span>
            <span className="font-bold text-sky-300">{metrics.totalEvents}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Bloqueados:</span>
            <span className="font-bold text-amber-300">{metrics.blockedCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Motor:</span>
            <span className="font-bold text-emerald-300 capitalize">{mode}</span>
          </div>
        </div>
      </header>

      {/* Selector de Sesión por Fechas y Explorador de Carpetas */}
      <SessionSelector
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        mode={mode}
        onModeChange={handleModeChange}
        onControlSimulator={handleControlSimulator}
        simStatus={simStatus}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        customDirectory={customDirectory}
        onSetCustomDirectory={handleSetCustomDirectory}
        onRefreshSessions={fetchSessions}
      />

      {/* Oficina Gamificada 2D con Phaser */}
      <main className="flex-1 flex justify-center items-center">
        <PhaserGame
          onGameReady={(scene) => {
            officeSceneRef.current = scene;
          }}
          onAgentSelect={(agent) => {
            setSelectedAgent(agent);
          }}
        />
      </main>

      {/* Panel Lateral con Telemetría al dar Clic en Avatar */}
      <AgentSidebar
        agent={selectedAgent}
        logs={telemetryLogs.filter((l) => !selectedAgent || l.agentId === selectedAgent.agentId)}
        agentStats={selectedAgent ? agentStats[selectedAgent.agentId] : null}
        allAgentStats={agentStats}
        onSelectAgent={(agentId) => {
          if (agentStats[agentId]) {
            setSelectedAgent({
              agentId,
              agentRole: agentStats[agentId].agentRole,
              state: agentStats[agentId].state
            });
          }
        }}
        onClose={() => setSelectedAgent(null)}
        onSendResponse={handleSendResponse}
      />
    </div>
  );
}

export default App;
