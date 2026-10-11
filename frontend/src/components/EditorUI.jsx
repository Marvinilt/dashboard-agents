import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Grid3x3, MapPin, Undo2, Redo2, Save, X, BoxSelect, SquareStack, ZoomIn, ZoomOut, Maximize, Minimize, Sun, Moon } from 'lucide-react';
import './EditorUI.css';

const objetoFiles = import.meta.glob('../assets/objetos/*.png', { eager: true, import: 'default' });
const estructuraFiles = import.meta.glob('../assets/estructura/*.png', { eager: true, import: 'default' });

const defaultSizes = {
  'desk_tl': { width: 134.4, height: 102.4 },
  'desk_4': { width: 102.4, height: 76.8 },
  'sofa': { width: 144, height: 96 },
  'sofa_recto': { width: 112, height: 41.6 },
  'sofa_single': { width: 38.4, height: 38.4 },
  'coffee_bar': { width: 137.6, height: 67.2 },
  'bar_stool': { width: 24, height: 24 },
  'tv_wall': { width: 144, height: 51.2 },
  'water_cooler': { width: 38.4, height: 44.8 },
  'printer': { width: 44.8, height: 38.4 },
  'plant_1': { width: 38.4, height: 38.4 },
  'plant_2': { width: 32, height: 38.4 },
  'plant_3': { width: 32, height: 32 },
  'pared_divisoria_cafe': { width: 32, height: 64 },
  'desk_4_caoba': { width: 102.4, height: 76.8 },
  'estacion_cafe_escritorio': { width: 64, height: 48 },
};

const mapToCatalog = (files, isStructure = false) => Object.keys(files).map((path) => {
  const filename = path.split('/').pop().replace('.png', '');
  const size = isStructure ? { width: 32, height: 32 } : (defaultSizes[filename] || { width: 64, height: 64 });
  return {
    id: `prop_${filename}`,
    src: files[path],
    width: size.width,
    height: size.height
  };
});

const objetoProps = mapToCatalog(objetoFiles, false);
const estructuraProps = mapToCatalog(estructuraFiles, true);

export function EditorUI({ onModeChange, isMaximized: propIsMaximized }) {
  const [activeMode, setActiveMode] = useState('PLAY');
  const [internalIsMaximized, setInternalIsMaximized] = useState(false);
  const isMaximized = propIsMaximized !== undefined ? propIsMaximized : internalIsMaximized;
  
  const [activeBrush, setActiveBrush] = useState(null);
  const [activeStructureBrush, setActiveStructureBrush] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);

  const [isDayMode, setIsDayMode] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('office_theme') === 'day';
  });

  const toggleDayNight = () => {
    const nextMode = !isDayMode;
    setIsDayMode(nextMode);
    localStorage.setItem('office_theme', nextMode ? 'day' : 'night');
    window.dispatchEvent(new CustomEvent('toggle-day-night', { detail: { isDay: nextMode } }));
  };

  useEffect(() => {
    const el = document.getElementById('editor-sidebar-portal');
    if (el) setPortalTarget(el);
  }, []);

  // Escuchar si se cerró desde otro lugar
  useEffect(() => {
    const handleAction = (e) => {
      if (e.detail.action === 'TOGGLE_MAXIMIZE') {
        setInternalIsMaximized(prev => !prev);
      }
    };
    window.addEventListener('editor-action', handleAction);
    return () => window.removeEventListener('editor-action', handleAction);
  }, []);

  const handleModeSwitch = (mode) => {
    setActiveMode(mode);
    setActiveBrush(null);
    setActiveStructureBrush(null);
    window.dispatchEvent(new CustomEvent('set-node-brush', { detail: { type: null } }));
    window.dispatchEvent(new CustomEvent('set-structure-brush', { detail: { prop: null } }));
    const event = new CustomEvent('set-editor-mode', { detail: { mode } });
    window.dispatchEvent(event);
    if (onModeChange) onModeChange(mode);
  };

  const handleDragStart = (prop) => {
    window.currentDragItem = prop;
  };

  const handleDragEnd = () => {
    window.currentDragItem = null;
  };

  const handleBrushSelect = (type) => {
    const newBrush = activeBrush === type ? null : type;
    setActiveBrush(newBrush);
    window.dispatchEvent(new CustomEvent('set-node-brush', { detail: { type: newBrush } }));
  };

  const handleStructureBrushSelect = (prop) => {
    const newBrush = activeStructureBrush?.id === prop.id ? null : prop;
    setActiveStructureBrush(newBrush);
    window.dispatchEvent(new CustomEvent('set-structure-brush', { detail: { prop: newBrush } }));
  };

  const emitEditorAction = (action, payload = null) => {
    window.dispatchEvent(new CustomEvent('editor-action', { detail: { action, payload } }));
  };

  const toggleFullscreen = () => {
    setInternalIsMaximized(!isMaximized);
    emitEditorAction('TOGGLE_MAXIMIZE');
  };

  const isEditorMode = activeMode !== 'PLAY';

  return (
    <>
      <div className="editor-top-bar float-bar">
        <div className="mode-toggles">
          <button className={activeMode === 'PLAY' ? 'active' : ''} onClick={() => handleModeSwitch('PLAY')} title="Jugar"><Play size={14} /></button>
          <button className={activeMode === 'EDIT_STRUCTURE' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_STRUCTURE')} title="Estructura"><SquareStack size={14} /></button>
          <button className={activeMode === 'EDIT_LAYOUT' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_LAYOUT')} title="Diseño"><BoxSelect size={14} /></button>
          <button className={activeMode === 'EDIT_COLLISION' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_COLLISION')} title="Colisiones"><Grid3x3 size={14} /></button>
          <button className={activeMode === 'EDIT_NODES' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_NODES')} title="Posiciones"><MapPin size={14} /></button>
        </div>

        <div className="editor-actions divider" />

        <div className="editor-actions">
          <button 
            className={`icon-btn ${isDayMode ? 'active' : ''}`} 
            onClick={toggleDayNight} 
            title={isDayMode ? "Cambiar a Fondo Noche" : "Cambiar a Fondo Día"}
            style={isDayMode ? { color: '#fbbf24' } : {}}
          >
            {isDayMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button className="icon-btn" onClick={() => emitEditorAction('ZOOM', 1.0)} title="Zoom 100%">100%</button>
          <button className="icon-btn" onClick={() => emitEditorAction('ZOOM', 1.25)} title="Zoom 125%">125%</button>
          <button className="icon-btn" onClick={() => emitEditorAction('ZOOM', 1.5)} title="Zoom 150%">150%</button>
          <button className={`icon-btn ${isMaximized ? 'active' : ''}`} onClick={toggleFullscreen} title={isMaximized ? "Restaurar tamaño normal" : "Maximizar en el área de trabajo"}>
            {isMaximized ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>

        {isEditorMode && (
          <>
            <div className="editor-actions divider" />
            <div className="editor-actions">
              <button className="icon-btn" onClick={() => emitEditorAction('UNDO')} title="Deshacer"><Undo2 size={14} /></button>
              <button className="icon-btn" onClick={() => emitEditorAction('REDO')} title="Rehacer"><Redo2 size={14} /></button>
              <button className="icon-btn text-red" onClick={() => emitEditorAction('RELOAD')} title="Descartar"><X size={14} /></button>
              <button className="icon-btn text-green" onClick={() => emitEditorAction('SAVE')} title="Descargar JSON"><Save size={14} /></button>
            </div>
          </>
        )}
      </div>

      {(!isMaximized && (activeMode === 'EDIT_LAYOUT' || activeMode === 'EDIT_STRUCTURE' || activeMode === 'EDIT_NODES')) && 
        (portalTarget || (typeof document !== 'undefined' && document.getElementById('editor-sidebar-portal'))) && 
        createPortal(
          <div className="editor-sidebar">
            {activeMode === 'EDIT_STRUCTURE' ? (
              <div className="sidebar-content">
                <div className="catalog-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {estructuraProps.map(prop => (
                    <div 
                      className={`catalog-item ${activeStructureBrush?.id === prop.id ? 'brush-active' : ''}`} 
                      key={prop.id} 
                      onClick={() => handleStructureBrushSelect(prop)}
                      style={{ 
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderColor: activeStructureBrush?.id === prop.id ? '#38bdf8' : '#334155',
                        boxShadow: activeStructureBrush?.id === prop.id ? '0 0 10px rgba(56, 189, 248, 0.6)' : 'none',
                        background: activeStructureBrush?.id === prop.id ? '#0f2942' : 'transparent',
                        borderRadius: '6px'
                      }}
                      title={`Pincel: ${prop.id.replace('prop_', '')}`}
                    >
                      <img src={prop.src} alt="" className="catalog-img" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : activeMode === 'EDIT_LAYOUT' ? (
              <div className="sidebar-content">
                <div className="catalog-grid">
                  {objetoProps.map(prop => (
                    <div 
                      className="catalog-item" 
                      key={prop.id} 
                      draggable="true"
                      onDragStart={() => handleDragStart(prop)}
                      onDragEnd={handleDragEnd}
                    >
                      <img src={prop.src} alt="" className="catalog-img" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="sidebar-content">
                <div className="text-[10px] font-mono text-slate-400 text-center mb-2 pb-1 border-b border-slate-800">
                  Tipo de Posición
                </div>
                <div className="flex flex-col gap-2.5">
                  <button 
                    type="button"
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all text-center gap-2 w-full cursor-pointer ${
                      activeBrush === 'node_work' 
                        ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)] text-emerald-300' 
                        : 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/70 hover:bg-slate-850 text-slate-300'
                    }`}
                    onClick={() => handleBrushSelect('node_work')}
                    title="Pincel: Posición de Trabajo"
                  >
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-emerald-400 bg-emerald-600 shadow-sm shrink-0" 
                    />
                    <span className="text-[11px] font-bold leading-tight">Posición de Trabajo</span>
                  </button>

                  <button 
                    type="button"
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all text-center gap-2 w-full cursor-pointer ${
                      activeBrush === 'node_lounge' 
                        ? 'bg-blue-950/80 border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.45)] text-blue-300' 
                        : 'bg-slate-900/90 border-slate-700/80 hover:border-blue-500/70 hover:bg-slate-850 text-slate-300'
                    }`}
                    onClick={() => handleBrushSelect('node_lounge')}
                    title="Pincel: Posición de Descanso"
                  >
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-blue-400 bg-blue-600 shadow-sm shrink-0" 
                    />
                    <span className="text-[11px] font-bold leading-tight">Posición de Descanso</span>
                  </button>
                </div>
              </div>
            )}
          </div>,
          portalTarget || document.getElementById('editor-sidebar-portal')
        )}
    </>
  );
}
