import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { PhaserGame } from './components/PhaserGame';
import { SessionSelector } from './components/SessionSelector';
import { AgentSidebar } from './components/AgentSidebar';
import { EditorUI } from './components/EditorUI';
import { Bot, Activity, CheckCircle, ShieldAlert, Cpu, Clock, Terminal } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001';

const ROLE_BADGES = {
  team_leader: { name: 'Team Leader', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  designer: { name: 'UI/UX Designer', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  dba: { name: 'Arquitecto DBA', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  developer: { name: 'Senior Developer', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  qa_tester: { name: 'QA SDET', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  security: { name: 'Auditor Seguridad', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  documenter: { name: 'Documentador', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  document: { name: 'Documentador', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  docs: { name: 'Documentador', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
};

const formatTime = (ts) => {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDuration = (ms) => {
  if (!ms || ms < 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [customDirectory, setCustomDirectory] = useState('');
  const [mode, setMode] = useState('simulation');
  const [speed, setSpeed] = useState(3);
  const [simStatus, setSimStatus] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [hoveredAvatar, setHoveredAvatar] = useState(null);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [agentStats, setAgentStats] = useState({});
  const [metrics, setMetrics] = useState({
    activeAgents: 0,
    blockedCount: 0,
    totalEvents: 0
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [editorMode, setEditorMode] = useState('PLAY');

  useEffect(() => {
    const handleEditorAction = (e) => {
      if (e.detail.action === 'TOGGLE_MAXIMIZE') {
        setIsMaximized(prev => !prev);
      }
    };
    const handleEditorMode = (e) => {
      setEditorMode(e.detail.mode);
    };
    window.addEventListener('editor-action', handleEditorAction);
    window.addEventListener('set-editor-mode', handleEditorMode);
    return () => {
      window.removeEventListener('editor-action', handleEditorAction);
      window.removeEventListener('set-editor-mode', handleEditorMode);
    };
  }, []);

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
      setTelemetryLogs((prev) => [...prev.slice(-500), event]);

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

  const selectedAgentLogs = useMemo(() => {
    if (!selectedAgent?.agentId) return [];
    const list = telemetryLogs.filter((l) => l.agentId === selectedAgent.agentId);
    const seen = new Set();
    const deduped = [];
    for (const l of list) {
      const key = l.eventId || `${l.stepIndex}_${l.timestamp}_${l.state}_${l.metadata?.detailMessage || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(l);
      }
    }
    return deduped;
  }, [selectedAgent?.agentId, telemetryLogs]);

  const hoveredLatestLog = useMemo(() => {
    if (!hoveredAvatar?.agentId) return null;
    for (let i = telemetryLogs.length - 1; i >= 0; i--) {
      if (telemetryLogs[i].agentId === hoveredAvatar.agentId) {
        return telemetryLogs[i];
      }
    }
    return null;
  }, [hoveredAvatar?.agentId, telemetryLogs]);

  const hoveredLatestMessage = hoveredLatestLog?.metadata?.detailMessage 
    || hoveredLatestLog?.metadata?.rawContentSnippet 
    || (hoveredLatestLog?.metadata?.toolInUse ? `Herramienta: ${hoveredLatestLog.metadata.toolInUse}` : null)
    || hoveredAvatar?.lastLogMessage 
    || 'Sin actividad registrada';

  const hoveredStartTime = hoveredAvatar?.startTime
    || (agentStats[hoveredAvatar?.agentId]?.startTime ? new Date(agentStats[hoveredAvatar.agentId].startTime).getTime() : null);

  const hoveredLastLogTime = (hoveredLatestLog?.timestamp ? new Date(hoveredLatestLog.timestamp).getTime() : null)
    || hoveredAvatar?.lastLogTime;

  const hoveredWorkDurationMs = (hoveredStartTime && hoveredLastLogTime)
    ? Math.max(0, hoveredLastLogTime - hoveredStartTime)
    : (hoveredAvatar?.workDurationMs || 0);

  const handleGameReady = useCallback((scene) => {
    officeSceneRef.current = scene;
  }, []);

  const handleAgentSelect = useCallback((agent) => {
    setSelectedAgent((prev) => (prev && prev.agentId === agent.agentId ? null : agent));
  }, []);

  const handleAvatarHover = useCallback((data) => {
    setHoveredAvatar((prev) => {
      if (!prev) return data;
      if (
        prev.agentId === data.agentId &&
        prev.state === data.state &&
        prev.lastLogMessage === data.lastLogMessage &&
        prev.lastLogTime === data.lastLogTime &&
        Math.abs(prev.clientX - data.clientX) < 1 &&
        Math.abs(prev.clientY - data.clientY) < 1
      ) {
        return prev;
      }
      return data;
    });
  }, []);

  const handleAvatarHoverOut = useCallback((data) => {
    setHoveredAvatar((prev) => (prev?.agentId === data.agentId ? null : prev));
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Panel Lateral con Telemetría al dar Clic en Avatar (Empuja el sitio hacia la derecha) */}
      <AgentSidebar
        agent={selectedAgent}
        logs={selectedAgentLogs}
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

      {/* Contenedor Principal: se ajusta al ancho y se desplaza hacia la derecha */}
      <div className={`flex-1 flex flex-col h-full min-w-0 transition-all duration-300 ${
        isMaximized ? 'p-2 sm:p-2.5 space-y-1.5 overflow-hidden' : 'p-3 sm:p-4 space-y-2.5 overflow-y-auto'
      }`}>
        {/* Top Navbar / HUD Corporativo Gaming Compacto */}
        <header className={`flex items-center justify-between border-b border-slate-800 shrink-0 transition-all ${
          isMaximized ? 'pb-1.5' : 'pb-2.5'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                Agent Virtual HQ
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                  v1.1
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Observabilidad gamificada en tiempo real para orquestadores multi-agente
              </p>
            </div>
          </div>

          {/* Mini Contadores HUD Compactos */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400 text-[11px]">Eventos:</span>
              <span className="font-bold text-sky-300">{metrics.totalEvents}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 text-[11px]">Bloqueados:</span>
              <span className="font-bold text-amber-300">{metrics.blockedCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400 text-[11px]">Motor:</span>
              <span className="font-bold text-emerald-300 capitalize">{mode}</span>
            </div>
          </div>
        </header>

        {/* Selector de Sesión por Fechas Compacto */}
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

        <main className={`flex-1 flex flex-col items-center min-h-0 w-full transition-all duration-300 ${
          isMaximized ? 'p-0 gap-1.5 h-full' : 'p-2 gap-2'
        }`}>
          <EditorUI onModeChange={(mode) => setEditorMode(mode)} isMaximized={isMaximized} />
          
          <div className={`flex flex-row justify-center w-full transition-all duration-300 ${
            isMaximized 
              ? 'flex-1 min-h-0 h-full max-w-none' 
              : (editorMode === 'EDIT_LAYOUT' || editorMode === 'EDIT_STRUCTURE' || editorMode === 'EDIT_NODES')
              ? 'max-w-[1020px]' 
              : 'max-w-[864px]'
          }`}>
            <div className={`relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex-1 w-full ${
              isMaximized ? 'h-full min-h-0' : 'h-[512px]'
            }`}>
              <PhaserGame
                onGameReady={handleGameReady}
                onAgentSelect={handleAgentSelect}
                onAvatarHover={handleAvatarHover}
                onAvatarHoverOut={handleAvatarHoverOut}
              />
            </div>
            
            <div className={`w-[140px] ml-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shrink-0 ${
              (editorMode === 'EDIT_LAYOUT' || editorMode === 'EDIT_STRUCTURE' || editorMode === 'EDIT_NODES')
                ? 'flex flex-col'
                : 'hidden'
            }`}>
              <div id="editor-sidebar-portal" className="w-full h-full overflow-y-auto" />
            </div>
          </div>

          {!isMaximized && (
            <div className={`text-[11px] font-mono text-slate-500 w-full text-center bg-slate-900/50 py-1 rounded-lg border border-slate-800/50 transition-all ${
              (editorMode === 'EDIT_LAYOUT' || editorMode === 'EDIT_STRUCTURE' || editorMode === 'EDIT_NODES')
                ? 'max-w-[1020px]'
                : 'max-w-[864px]'
            }`}>
              {editorMode === 'EDIT_LAYOUT' 
                ? '🖱️ Arrastra props | R = Rotar | Q/E = Escalar | Shift+Click = Borrar | Espacio/WASD = Mover cámara'
                : editorMode === 'EDIT_STRUCTURE'
                ? '🖱️ Clic en piso/pared y pinta con clic sostenido | Shift+Click = Borrar | R = Rotar | Espacio/WASD = Mover cámara'
                : editorMode === 'EDIT_NODES'
                ? '🖱️ Clic para colocar posición | R = Cambiar dirección del asiento del avatar | Shift+Click = Borrar | Espacio/WASD = Mover cámara'
                : editorMode === 'EDIT_COLLISION'
                ? '🟥 Cuadros rojos = Zonas bloqueadas (el avatar no puede pasar) | Clic = Pintar | Shift+Click = Quitar bloqueo | Espacio/WASD = Mover cámara'
                : '🖱️ Haz clic en cualquier avatar para inspeccionar telemetría'}
            </div>
          )}
        </main>
      </div>

      {/* Tooltip / Modal Flotante de Hover sobre Avatar */}
      {hoveredAvatar && hoveredAvatar.clientX > 0 && hoveredAvatar.clientY > 0 && (
        <div
          className="fixed z-[200] pointer-events-none select-none will-change-transform"
          style={{
            left: `${Math.max(170, Math.min(window.innerWidth - 170, hoveredAvatar.clientX))}px`,
            top: `${Math.max(90, hoveredAvatar.clientY - 12)}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="relative bg-slate-900 border border-slate-700/80 shadow-2xl rounded-xl p-3 w-80 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header con solo el título con colores a la derecha y estado a la izquierda */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  {hoveredAvatar.state || 'ACTIVO'}
                </span>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded border font-mono font-bold shrink-0 ${ROLE_BADGES[hoveredAvatar.agentRole]?.color || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                {ROLE_BADGES[hoveredAvatar.agentRole]?.name || hoveredAvatar.agentRole}
              </span>
            </div>

            {/* Métricas: Hora de inicio y Tiempo de trabajo */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 font-mono text-[11px]">
              <div className="flex flex-col bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80">
                <span className="text-[10px] text-slate-400">Hora de inicio</span>
                <span className="font-bold text-slate-200">
                  {formatTime(hoveredStartTime)}
                </span>
              </div>
              <div className="flex flex-col bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80">
                <span className="text-[10px] text-slate-400">Tiempo de trabajo</span>
                <span className="font-bold text-emerald-400">
                  {formatDuration(hoveredWorkDurationMs)}
                </span>
              </div>
            </div>

            {/* Tiempo de espera desde último log */}
            <div className="flex items-center justify-between bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80 mb-2 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Tiempo de espera:</span>
              </div>
              <span className="font-bold text-amber-300">
                {hoveredAvatar.minutesWaiting > 0 ? `${hoveredAvatar.minutesWaiting} min` : '< 1 min'}
              </span>
            </div>

            {/* Último log (el más reciente) con hora al lado del título */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider">
                <div className="flex items-center gap-1 uppercase text-slate-400">
                  <Terminal className="w-3 h-3 text-sky-400" />
                  <span>Último log:</span>
                </div>
                <span className="font-mono text-slate-400 text-[10px] font-normal tracking-normal">
                  {formatTime(hoveredLastLogTime)}
                </span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 leading-4 break-words h-[82px] overflow-hidden flex flex-col justify-start">
                <p className="line-clamp-4">
                  {hoveredLatestMessage}
                </p>
              </div>
            </div>

            {/* Flechita inferior indicadora hacia el avatar */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-slate-700/80 transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
