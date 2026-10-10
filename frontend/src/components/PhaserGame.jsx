import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from '../game/OfficeScene';
import { gameEvents, EVENTS } from '../game/eventBus';

export const PhaserGame = ({ onAgentSelect, onGameReady }) => {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 864,
        height: 512,
      },
      backgroundColor: '#090d16',
      scene: [OfficeScene],
      physics: {
        default: 'arcade',
        arcade: { debug: false }
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.events.once('ready', () => {
      const scene = game.scene.getScene('OfficeScene');
      sceneRef.current = scene;
      if (onGameReady) onGameReady(scene);
    });

    const handleSelect = (agent) => {
      if (onAgentSelect) onAgentSelect(agent);
    };

    gameEvents.on(EVENTS.AGENT_SELECTED, handleSelect);

    return () => {
      gameEvents.off(EVENTS.AGENT_SELECTED, handleSelect);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-slate-950 flex justify-center items-center">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

