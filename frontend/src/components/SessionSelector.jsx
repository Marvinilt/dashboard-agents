import React from 'react';
import { Play, Pause, FastForward, FolderKanban, Radio } from 'lucide-react';

export const SessionSelector = ({
  sessions = [],
  selectedSessionId,
  onSelectSession,
  mode,
  onModeChange,
  onControlSimulator,
  simStatus,
  speed,
  onSpeedChange
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
      {/* Selector de Proyecto/Sesión */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
          <FolderKanban className="w-5 h-5" />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
            Sesión / Proyecto Activo
          </label>
          <select
            value={selectedSessionId || ''}
            onChange={(e) => onSelectSession(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono w-72"
          >
            <option value="" disabled>-- Elige una conversación --</option>
            {sessions.map((sess) => (
              <option key={sess.id} value={sess.id}>
                {sess.name} ({Math.round(sess.sizeBytes / 1024)} KB)
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

      {/* Controles de Playback (Solo en modo simulación) */}
      {mode === 'simulation' && (
        <div className="flex items-center gap-2">
          {simStatus?.isRunning ? (
            <button
              onClick={() => onControlSimulator('pause')}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 text-xs font-medium"
            >
              <Pause className="w-3.5 h-3.5" /> Pausar
            </button>
          ) : (
            <button
              onClick={() => onControlSimulator('play')}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 text-xs font-medium"
            >
              <Play className="w-3.5 h-3.5" /> Reanudar
            </button>
          )}

          {/* Velocidad de Simulación */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
            <FastForward className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="bg-transparent text-slate-200 focus:outline-none font-mono"
            >
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
