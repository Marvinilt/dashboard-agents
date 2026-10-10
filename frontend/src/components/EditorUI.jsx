import React, { useState, useEffect } from 'react';
import { Play, Grid3x3, MapPin, Undo2, Redo2, Save, X, BoxSelect, SquareStack, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
import './EditorUI.css';

import deskTlImg from '../assets/desk_tl.png';
import desk4Img from '../assets/desk_4.png';
import sofaImg from '../assets/sofa.png';
import sofaRectoImg from '../assets/sofa_recto.png';
import sofaSingleImg from '../assets/sofa_single.png';
import coffeeBarImg from '../assets/coffee_bar.png';
import barStoolImg from '../assets/bar_stool.png';
import plant1Img from '../assets/plant_1.png';
import plant2Img from '../assets/plant_2.png';
import plant3Img from '../assets/plant_3.png';
import tvWallImg from '../assets/tv_wall.png';
import waterCoolerImg from '../assets/water_cooler.png';
import printerImg from '../assets/printer.png';

const catalogProps = [
  { id: 'prop_desk_tl', src: deskTlImg, width: 134.4, height: 102.4 },
  { id: 'prop_desk_4', src: desk4Img, width: 102.4, height: 76.8 },
  { id: 'prop_sofa', src: sofaImg, width: 144, height: 96 },
  { id: 'prop_sofa_recto', src: sofaRectoImg, width: 112, height: 41.6 },
  { id: 'prop_sofa_single', src: sofaSingleImg, width: 38.4, height: 38.4 },
  { id: 'prop_coffee_bar', src: coffeeBarImg, width: 137.6, height: 67.2 },
  { id: 'prop_bar_stool', src: barStoolImg, width: 24, height: 24 },
  { id: 'prop_tv_wall', src: tvWallImg, width: 144, height: 51.2 },
  { id: 'prop_water_cooler', src: waterCoolerImg, width: 38.4, height: 44.8 },
  { id: 'prop_printer', src: printerImg, width: 44.8, height: 38.4 },
  { id: 'prop_plant_1', src: plant1Img, width: 38.4, height: 38.4 },
  { id: 'prop_plant_2', src: plant2Img, width: 32, height: 38.4 },
  { id: 'prop_plant_3', src: plant3Img, width: 32, height: 32 },
];

export function EditorUI({ onModeChange }) {
  const [activeMode, setActiveMode] = useState('PLAY');
  const [isMaximized, setIsMaximized] = useState(false);
  
  const [activeBrush, setActiveBrush] = useState(null);

  // Escuchar si se cerró desde otro lugar
  useEffect(() => {
    const handleAction = (e) => {
      if (e.detail.action === 'TOGGLE_MAXIMIZE') {
        // En un caso real podríamos sincronizar el estado, pero como App.jsx maneja el CSS, aquí solo mandamos el evento
      }
    };
    window.addEventListener('editor-action', handleAction);
    return () => window.removeEventListener('editor-action', handleAction);
  }, []);

  const handleModeSwitch = (mode) => {
    setActiveMode(mode);
    setActiveBrush(null);
    window.dispatchEvent(new CustomEvent('set-node-brush', { detail: { type: null } }));
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

  const emitEditorAction = (action, payload = null) => {
    window.dispatchEvent(new CustomEvent('editor-action', { detail: { action, payload } }));
  };

  const toggleFullscreen = () => {
    setIsMaximized(!isMaximized);
    emitEditorAction('TOGGLE_MAXIMIZE');
  };

  const isEditorMode = activeMode !== 'PLAY';

  // Si está en fullscreen pero el modo es PLAY, ocultamos toda la UI para inmersión
  if (isMaximized && !isEditorMode) {
    return (
      <div className="editor-top-bar float-bar float-zen">
        <button className="icon-btn active" onClick={toggleFullscreen} title="Salir de Pantalla Completa"><Minimize size={14} /></button>
      </div>
    );
  }

  return (
    <>
      <div className="editor-top-bar float-bar">
        <div className="mode-toggles">
          <button className={activeMode === 'PLAY' ? 'active' : ''} onClick={() => handleModeSwitch('PLAY')} title="Jugar"><Play size={14} /></button>
          <button className={activeMode === 'EDIT_LAYOUT' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_LAYOUT')} title="Diseño"><BoxSelect size={14} /></button>
          <button className={activeMode === 'EDIT_COLLISION' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_COLLISION')} title="Colisiones"><Grid3x3 size={14} /></button>
          <button className={activeMode === 'EDIT_NODES' ? 'active' : ''} onClick={() => handleModeSwitch('EDIT_NODES')} title="Posiciones"><MapPin size={14} /></button>
        </div>

        <div className="editor-actions divider" />

        <div className="editor-actions">
          <button className="icon-btn" onClick={() => emitEditorAction('ZOOM', 1.0)} title="Zoom 100%">100%</button>
          <button className="icon-btn" onClick={() => emitEditorAction('ZOOM', 1.25)} title="Zoom 125%">125%</button>
          <button className="icon-btn" onClick={() => emitEditorAction('ZOOM', 1.5)} title="Zoom 150%">150%</button>
          <button className="icon-btn" onClick={toggleFullscreen} title="Pantalla Completa">
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

      {(activeMode === 'EDIT_LAYOUT' || activeMode === 'EDIT_NODES') && (
        <div className="editor-sidebar">
          {activeMode === 'EDIT_LAYOUT' ? (
            <div className="sidebar-content">
              <div className="catalog-grid">
                {catalogProps.map(prop => (
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
              <div className="catalog-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div 
                  className={`catalog-item node-item ${activeBrush === 'node_work' ? 'brush-active' : ''}`} 
                  onClick={() => handleBrushSelect('node_work')}
                  style={{ background: '#064e3b', borderColor: activeBrush === 'node_work' ? '#34d399' : '#10b981', boxShadow: activeBrush === 'node_work' ? '0 0 8px #34d399' : 'none', cursor: 'pointer' }}
                  title="Pincel: Nodo Trabajo"
                />
                <div 
                  className={`catalog-item node-item ${activeBrush === 'node_lounge' ? 'brush-active' : ''}`} 
                  onClick={() => handleBrushSelect('node_lounge')}
                  style={{ background: '#1e3a8a', borderColor: activeBrush === 'node_lounge' ? '#60a5fa' : '#3b82f6', boxShadow: activeBrush === 'node_lounge' ? '0 0 8px #60a5fa' : 'none', cursor: 'pointer' }}
                  title="Pincel: Nodo Descanso"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
