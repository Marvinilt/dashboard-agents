/**
 * Genera texturas procedurales tipo pixel-art / isométrica limpias para la oficina
 */
export function generateProceduralTextures(scene) {
  // 1. Baldosa de piso Isométrica (Tile 64x32)
  if (!scene.textures.exists('floor_tile')) {
    const floorG = scene.make.graphics({ x: 0, y: 0, add: false });
    floorG.fillStyle(0x1e293b, 1); // Slate oscuro
    floorG.lineStyle(1, 0x334155, 0.8);
    // Dibujar rombo isométrico
    floorG.beginPath();
    floorG.moveTo(32, 0);
    floorG.lineTo(64, 16);
    floorG.lineTo(32, 32);
    floorG.lineTo(0, 16);
    floorG.closePath();
    floorG.fillPath();
    floorG.strokePath();
    floorG.generateTexture('floor_tile', 64, 32);
    floorG.destroy();
  }

  // 1.b Baldosa de sala de descanso (Madera / Alfombra acogedora)
  if (!scene.textures.exists('lounge_tile')) {
    const loungeG = scene.make.graphics({ x: 0, y: 0, add: false });
    loungeG.fillStyle(0x3f2d22, 1); // Tono cálido madera/alfombra
    loungeG.lineStyle(1, 0x78350f, 0.8);
    loungeG.beginPath();
    loungeG.moveTo(32, 0);
    loungeG.lineTo(64, 16);
    loungeG.lineTo(32, 32);
    loungeG.lineTo(0, 16);
    loungeG.closePath();
    loungeG.fillPath();
    loungeG.strokePath();
    loungeG.generateTexture('lounge_tile', 64, 32);
    loungeG.destroy();
  }

  // 2. Escritorio + Computadora + Silla
  if (!scene.textures.exists('desk_workstation')) {
    const deskG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Mesa
    deskG.fillStyle(0x475569, 1);
    deskG.lineStyle(1, 0x64748b, 1);
    deskG.fillRect(8, 18, 48, 20);
    deskG.strokeRect(8, 18, 48, 20);

    // Patas mesa
    deskG.fillStyle(0x334155, 1);
    deskG.fillRect(10, 38, 4, 14);
    deskG.fillRect(50, 38, 4, 14);

    // Silla de oficina detrás/al frente
    deskG.fillStyle(0x1e293b, 1);
    deskG.fillCircle(32, 44, 9);
    deskG.lineStyle(2, 0x0284c7, 0.8);
    deskG.strokeCircle(32, 44, 9);

    // Monitor
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRect(22, 4, 20, 14);
    deskG.lineStyle(1, 0x38bdf8, 1);
    deskG.strokeRect(22, 4, 20, 14);

    // Soporte del monitor
    deskG.fillStyle(0x64748b, 1);
    deskG.fillRect(30, 18, 4, 3);

    // Teclado
    deskG.fillStyle(0x334155, 1);
    deskG.fillRect(23, 23, 18, 6);

    deskG.generateTexture('desk_workstation', 64, 56);
    deskG.destroy();
  }

  // 3. Sofá / Máquina de café para Sala de Descanso
  if (!scene.textures.exists('coffee_station')) {
    const coffeeG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Máquina dispensadora
    coffeeG.fillStyle(0x854d0e, 1);
    coffeeG.fillRect(6, 6, 36, 44);
    coffeeG.fillStyle(0xfef08a, 1);
    coffeeG.fillRect(14, 16, 20, 12);
    // Taza / logo
    coffeeG.fillStyle(0xffffff, 1);
    coffeeG.fillCircle(24, 38, 4);
    coffeeG.generateTexture('coffee_station', 48, 54);
    coffeeG.destroy();
  }

  // 4. Puerta de entrada (Spawn/Despawn point)
  if (!scene.textures.exists('door_portal')) {
    const doorG = scene.make.graphics({ x: 0, y: 0, add: false });
    doorG.fillStyle(0x0284c7, 0.3);
    doorG.fillRoundedRect(4, 4, 40, 52, 6);
    doorG.lineStyle(2, 0x38bdf8, 1);
    doorG.strokeRoundedRect(4, 4, 40, 52, 6);
    doorG.generateTexture('door_portal', 48, 60);
    doorG.destroy();
  }
}

