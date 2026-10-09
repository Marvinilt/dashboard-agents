import React, { useState } from 'react';
import { X, Maximize2, Minimize2, Terminal, Send, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export const AgentSidebar = ({ agent, logs = [], onClose, onSendResponse }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [responseInput, setResponseInput] = useState('');

  if (!agent) return null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!responseInput.trim()) return;
    onSendResponse(agent.agentId, responseInput);
    setResponseInput('');
  };

  const isWaitingInput = agent.state === 'WAITING_INPUT';

  return (
    <div
      className={`fixed transition-all duration-300 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl flex flex-col ${
        isMaximized
          ? 'inset-6 rounded-2xl'
          : 'top-20 right-6 w-96 max-h-[82vh] rounded-xl'
      }`}
    >
      {/* Header de la ventana */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              isWaitingInput
                ? 'bg-amber-500 animate-ping'
                : agent.state === 'WORKING'
                ? 'bg-sky-400'
                : 'bg-emerald-400'
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 font-mono">
              {agent.agentRole}
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">ID: {agent.agentId.slice(0, 10)}...</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:text-slate-100 hover:bg-slate-800 rounded transition"
            title={isMaximized ? "Minimizar" : "Maximizar"}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Badge de Estado Actual */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Estado:
        </span>
        <span
          className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
            isWaitingInput
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : agent.state === 'WORKING'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {agent.state}
        </span>
      </div>

      {/* Alerta de bloqueo si requiere input */}
      {isWaitingInput && (
        <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">¡El agente requiere tu atención!</p>
            <p className="text-amber-300/80 mt-0.5">Escribe las instrucciones o autorización para continuar.</p>
          </div>
        </div>
      )}

      {/* Terminal / Feed de Logs en tiempo real */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 font-mono text-xs text-slate-300">
        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] pb-1 border-b border-slate-800">
          <Terminal className="w-3.5 h-3.5" />
          <span>Feed de Actividad en Vivo</span>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 italic">
            Esperando eventos de telemetría...
          </div>
        ) : (
          logs.slice(-30).map((l, index) => (
            <div
              key={l.eventId || index}
              className="p-2 rounded bg-slate-950/70 border border-slate-800/60 leading-relaxed text-[11px]"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span className="text-sky-400 font-semibold">{l.metadata?.toolInUse || l.rawType}</span>
                <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-300">
                {l.metadata?.detailMessage || 'Paso procesado exitosamente.'}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Caja de Intervención / Input si está en espera */}
      {isWaitingInput && (
        <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
          <input
            type="text"
            value={responseInput}
            onChange={(e) => setResponseInput(e.target.value)}
            placeholder="Escribe comando o respuesta..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            <Send className="w-3.5 h-3.5" />
            Enviar
          </button>
        </form>
      )}
    </div>
  );
};

