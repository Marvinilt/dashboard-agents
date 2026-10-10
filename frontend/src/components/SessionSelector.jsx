import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, FolderKanban, Radio, Calendar, HardDrive, RefreshCw } from 'lucide-react';

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
  const [folderInput, setFolderInput] = useState(customDirectory || '');
  const [isChangingFolder, setIsChangingFolder] = useState(false);
  const [timelineValue, setTimelineValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging && simStatus) {
      setTimelineValue(simStatus.currentIndex || 0);
    }
  }, [simStatus?.currentIndex, isDragging]);

  const handleFolderSubmit = (e) => {
    e.preventDefault();
    if (!folderInput.trim()) return;
    onSetCustomDirectory(folderInput.trim());
    setIsChangingFolder(false);
  };

  const handleBrowseFolder = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/system/browse-folder');
      const data = await response.json();
      if (data.path) {
        setFolderInput(data.path);
        onSetCustomDirectory(data.path);
        setIsChangingFolder(false);
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Selector de Proyecto/Sesión con fechas */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Sesiones (Ordenadas por Fecha Reciente)
              </label>
              <button
                onClick={onRefreshSessions}
                className="text-slate-500 hover:text-slate-300 transition"
                title="Refrescar lista"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <select
              value={selectedSessionId || ''}
              onChange={(e) => onSelectSession(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono w-96 max-w-full cursor-pointer"
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
          </div>
        </div>

        {/* Modo de Ejecución: Simulación vs Live Watcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
          <button
            onClick={() => onModeChange('simulation')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              mode === 'simulation'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Simulador
          </button>
          <button
            onClick={() => onModeChange('live')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              mode === 'live'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Live Watcher
          </button>
        </div>

        {/* Controles de Playback (Modo Simulación) */}
        {mode === 'simulation' && (
          <div className="flex items-center gap-2">
            {simStatus?.isRunning ? (
              <button
                onClick={() => onControlSimulator('pause')}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 text-xs font-medium transition"
              >
                <Pause className="w-3.5 h-3.5" /> Pausar
              </button>
            ) : (
              <button
                onClick={() => onControlSimulator('play')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  !simStatus || simStatus.currentIndex === 0 || simStatus.currentIndex >= simStatus.totalEvents
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
                }`}
              >
                <Play className="w-3.5 h-3.5" /> {(!simStatus || simStatus.currentIndex === 0 || simStatus.currentIndex >= simStatus.totalEvents) ? 'Iniciar' : 'Reanudar'}
              </button>
            )}

            {/* Selector de velocidad con colores contrastados oscuros */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 focus-within:ring-1 focus-within:ring-sky-500 text-xs text-slate-300 shadow-sm">
              <FastForward className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <select
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                aria-label="Velocidad de reproducción"
                className="bg-slate-950 text-slate-100 focus:outline-none font-mono cursor-pointer text-xs pr-1"
              >
                <option value="1" className="bg-slate-900 text-slate-100 py-1.5">1x</option>
                <option value="2" className="bg-slate-900 text-slate-100 py-1.5">2x</option>
                <option value="3" className="bg-slate-900 text-slate-100 py-1.5">3x</option>
                <option value="5" className="bg-slate-900 text-slate-100 py-1.5">5x</option>
                <option value="10" className="bg-slate-900 text-slate-100 py-1.5">10x</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Timeline de Simulación */}
      {mode === 'simulation' && simStatus && simStatus.totalEvents > 0 && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5 px-1">
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

      {/* Barra de Exploración de Carpetas Arbitrarias del Sistema */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="shrink-0 text-slate-400">Carpeta del Sistema:</span>

          <button
            type="button"
            onClick={handleBrowseFolder}
            className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
            title="Abrir explorador de archivos"
          >
            <FolderKanban className="w-4 h-4" />
          </button>

          {isChangingFolder ? (
            <form onSubmit={handleFolderSubmit} className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="Ej: C:\Ruta\A\Tu\Proyecto o Carpeta Brain"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-xs transition"
              >
                Escanear
              </button>
              <button
                type="button"
                onClick={() => setIsChangingFolder(false)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <code className="text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate font-mono text-[11px]">
                {customDirectory || 'Carpeta por defecto de Antigravity Brain'}
              </code>
              <button
                onClick={() => setIsChangingFolder(true)}
                className="text-sky-400 hover:text-sky-300 underline underline-offset-2 shrink-0 font-medium"
              >
                Cambiar carpeta...
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Total Sesiones Encontradas: {sessions.length}</span>
        </div>
      </div>
    </div>
  );
};
