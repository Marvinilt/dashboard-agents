import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Terminal, Send, AlertCircle, Clock, Zap, Maximize2, Minimize2, Activity, PlayCircle } from 'lucide-react';

export const AgentSidebar = ({ agent, logs = [], onClose, onSendResponse }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [responseInput, setResponseInput] = useState('');

  // Expandir automáticamente cuando se seleccione un agente
  useEffect(() => {
    if (agent) {
      setIsOpen(true);
    }
  }, [agent]);

  if (!agent) {
    return (
      <div className="fixed top-24 left-0 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-slate-900 border border-l-0 border-slate-700 text-slate-400 hover:text-slate-200 px-2 py-4 rounded-r-xl shadow-xl flex flex-col items-center gap-2 transition hover:bg-slate-800"
          title="Ver agentes"
        >
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="text-[10px] font-mono [writing-mode:vertical-lr] tracking-widest text-slate-400 uppercase">
            Logs
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const handleSend = (e) => {
    e.preventDefault();
    if (!responseInput.trim()) return;
    onSendResponse(agent.agentId, responseInput);
    setResponseInput('');
  };

  const isWaitingInput = agent.state === 'WAITING_INPUT';

  // Calcular métricas del agente: Hora de inicio y cantidad de acciones ejecutadas
  const firstLog = logs[0];
  const startTime = firstLog?.timestamp
    ? new Date(firstLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  const actionsCount = logs.length;

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-50 flex transition-all duration-300 ease-in-out ${
        isOpen ? (isWide ? 'w-[520px]' : 'w-80 sm:w-96') : 'w-0'
      }`}
    >
      {/* Contenedor Principal del Panel */}
      <div className="w-full h-full bg-slate-900/98 backdrop-blur-xl border-r border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* 1. Header del Agente */}
        <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isWaitingInput
                  ? 'bg-amber-400 animate-ping'
                  : agent.state === 'WORKING'
                  ? 'bg-sky-400 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
            <div className="truncate">
              <h2 className="text-xs font-bold font-mono tracking-tight text-white uppercase truncate flex items-center gap-1.5">
                {agent.agentRole || 'Subagente'}
              </h2>
              <span className="text-[10px] text-slate-500 font-mono block truncate">
                {agent.agentId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-400 shrink-0">
            <button
              onClick={() => setIsWide(!isWide)}
              className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
              title={isWide ? "Modo compacto" : "Expandir ancho"}
            >
              {isWide ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                if (onClose) onClose();
              }}
              className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
              title="Colapsar panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Top Stats: Hora de inicio y Cantidad de acciones ejecutadas */}
        <div className="px-3.5 py-2 bg-slate-950/70 border-b border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
            <Clock className="w-3 h-3 text-sky-400 shrink-0" />
            <div className="truncate">
              <span className="text-[9px] text-slate-500 block uppercase">Inicio</span>
              <span className="font-semibold text-slate-200">{startTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
            <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
            <div className="truncate">
              <span className="text-[9px] text-slate-500 block uppercase">Acciones</span>
              <span className="font-semibold text-emerald-400">{actionsCount} ejecuciones</span>
            </div>
          </div>
        </div>

        {/* 3. Badge de Estado Actual */}
        <div className="px-3.5 py-1.5 bg-slate-900 border-b border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            Estado actual:
          </span>
          <span
            className={`px-2 py-0.2 rounded font-bold text-[10px] ${
              isWaitingInput
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : agent.state === 'WORKING'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {agent.state}
          </span>
        </div>

        {/* 4. Banner de Bloqueo si requiere input */}
        {isWaitingInput && (
          <div className="m-2.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-300 text-[11px]">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 animate-bounce" />
            <span className="font-medium truncate">Requiere respuesta o autorización humana</span>
          </div>
        )}

        {/* 5. Feed de Acciones Ultracompacto Vertical */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1 font-mono text-[11px] select-text">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-10">
              <Terminal className="w-6 h-6 mb-2 opacity-40" />
              <span>Sin acciones registradas aún</span>
            </div>
          ) : (
            logs.slice().reverse().map((l, index) => {
              const tool = l.metadata?.toolInUse || l.rawType || 'ACCION';
              const time = l.timestamp
                ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '';
              const message = l.metadata?.detailMessage || l.metadata?.rawContentSnippet || 'Paso procesado.';

              return (
                <div
                  key={l.eventId || index}
                  className="px-2 py-1.5 rounded bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-950 transition-all leading-snug group"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                    <span className="text-sky-400 font-bold group-hover:text-sky-300 truncate max-w-[190px]">
                      {tool}
                    </span>
                    <span className="text-slate-600 shrink-0 font-light">{time}</span>
                  </div>
                  <p className="text-slate-300 break-words text-[10.5px] font-sans leading-tight">
                    {message}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* 6. Formulario de Intervención / Input Humano */}
        {isWaitingInput && (
          <form onSubmit={handleSend} className="p-2.5 border-t border-slate-800 bg-slate-950 flex gap-1.5 shrink-0">
            <input
              type="text"
              value={responseInput}
              onChange={(e) => setResponseInput(e.target.value)}
              placeholder="Escribe comando o respuesta..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              autoFocus
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition shrink-0 shadow-sm"
            >
              <Send className="w-3 h-3" />
              Enviar
            </button>
          </form>
        )}
      </div>

      {/* Botón flotante para reabrir cuando el panel está colapsado */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute top-24 left-0 bg-slate-900 border border-l-0 border-slate-700 text-slate-300 hover:text-white px-2 py-4 rounded-r-xl shadow-2xl flex flex-col items-center gap-2 hover:bg-slate-800 transition"
          title="Ver detalle del agente"
        >
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="text-[10px] font-mono [writing-mode:vertical-lr] tracking-widest text-slate-400 uppercase">
            Logs
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  );
};
