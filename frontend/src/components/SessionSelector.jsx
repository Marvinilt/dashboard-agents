import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, FolderKanban, Radio, RefreshCw } from 'lucide-react';

export const SessionSelector = ({
  sessions = [],
  selectedSessionId,
  onSelectSession,
  mode,
  onModeChange,
  onControlSimulator,
  simStatus,
  speed,
  onSpeedChange,
  customDirectory,
  onSetCustomDirectory,
  onRefreshSessions
}) => {
  const [timelineValue, setTimelineValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging && simStatus) {
      setTimelineValue(simStatus.currentIndex || 0);
    }
  }, [simStatus?.currentIndex, isDragging]);

  const handleBrowseFolder = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/system/browse-folder');
      const data = await response.json();
      if (data.path) {
        onSetCustomDirectory(data.path);
      }
    } catch (error) {
      console.error('Error browsing folder:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col gap-2 shadow-md shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Selector de Proyecto/Sesión con botón de carpeta a la izquierda */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBrowseFolder}
            className="p-1.5 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/20 rounded-lg text-blue-400 transition cursor-pointer"
            title={customDirectory ? `Carpeta actual: ${customDirectory}\nClic para buscar en otra carpeta` : 'Seleccionar otra carpeta donde buscar sesiones'}
          >
            <FolderKanban className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5">
            <select
              value={selectedSessionId || ''}
              onChange={(e) => onSelectSession(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono w-72 sm:w-80 md:w-96 max-w-full cursor-pointer"
            >
              <option value="" disabled className="bg-slate-950 text-slate-400">-- Seleccionar Sesión --</option>
              {sessions.map((sess) => (
                <option
                  key={sess.id + sess.path}
                  value={sess.id}
                  className="bg-slate-900 text-slate-200 py-1"
                >
                  {sess.name} • {formatDate(sess.lastModified)} ({Math.round(sess.sizeBytes / 1024)} KB)
                </option>
              ))}
            </select>

            <button
              onClick={onRefreshSessions}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition cursor-pointer"
              title="Refrescar lista de sesiones"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modo de Ejecución: Simulación vs Live Watcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => onModeChange('simulation')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              mode === 'simulation'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3 h-3" />
            Simulador
          </button>
          <button
            onClick={() => onModeChange('live')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              mode === 'live'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3 h-3" />
            Live Watcher
          </button>
        </div>

        {/* Controles de Playback (Modo Simulación) */}
        {mode === 'simulation' && (
          <div className="flex items-center gap-2">
            {simStatus?.isRunning ? (
              <button
                onClick={() => onControlSimulator('pause')}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 text-xs font-medium transition cursor-pointer"
              >
                <Pause className="w-3 h-3" /> Pausar
              </button>
            ) : (
              <button
                onClick={() => onControlSimulator('play')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  !simStatus || simStatus.currentIndex === 0 || simStatus.currentIndex >= simStatus.totalEvents
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
                }`}
              >
                <Play className="w-3 h-3" /> {(!simStatus || simStatus.currentIndex === 0 || simStatus.currentIndex >= simStatus.totalEvents) ? 'Iniciar' : 'Reanudar'}
              </button>
            )}

            {/* Selector de velocidad con colores contrastados oscuros */}
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700 hover:border-slate-600 focus-within:ring-1 focus-within:ring-sky-500 text-xs text-slate-300 shadow-sm">
              <FastForward className="w-3 h-3 text-sky-400 shrink-0" />
              <select
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                aria-label="Velocidad de reproducción"
                className="bg-slate-950 text-slate-100 focus:outline-none font-mono cursor-pointer text-xs pr-1"
              >
                <option value="1" className="bg-slate-900 text-slate-100 py-1">1x</option>
                <option value="2" className="bg-slate-900 text-slate-100 py-1">2x</option>
                <option value="3" className="bg-slate-900 text-slate-100 py-1">3x</option>
                <option value="5" className="bg-slate-900 text-slate-100 py-1">5x</option>
                <option value="10" className="bg-slate-900 text-slate-100 py-1">10x</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Timeline de Simulación */}
      {mode === 'simulation' && simStatus && simStatus.totalEvents > 0 && (
        <div className="pt-1.5 border-t border-slate-800/80 flex flex-col gap-1 px-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span className="text-sky-400 font-medium">Progreso: {Math.round(((isDragging ? timelineValue : simStatus.currentIndex) / Math.max(1, simStatus.totalEvents)) * 100)}%</span>
            <span>{simStatus.currentTimestamp ? new Date(simStatus.currentTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
            <span>{isDragging ? timelineValue : simStatus.currentIndex} / {simStatus.totalEvents} Eventos</span>
          </div>
          <input 
            type="range"
            min="0"
            max={simStatus.totalEvents - 1}
            value={isDragging ? timelineValue : (simStatus.currentIndex || 0)}
            onPointerDown={() => setIsDragging(true)}
            onChange={(e) => setTimelineValue(parseInt(e.target.value, 10))}
            onPointerUp={(e) => {
              setIsDragging(false);
              onControlSimulator('jump', { index: parseInt(e.target.value, 10) });
            }}
            onPointerLeave={(e) => {
              if (isDragging) {
                setIsDragging(false);
                onControlSimulator('jump', { index: parseInt(e.target.value, 10) });
              }
            }}
            className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer hover:bg-slate-600 transition"
          />
        </div>
      )}
    </div>
  );
};
