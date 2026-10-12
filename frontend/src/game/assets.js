/**
 * Genera texturas procedurales tipo pixel-art / isométrica limpias para la oficina
 */
export function generateProceduralTextures(scene) {
  // 1. Baldosa de piso de Oficina (32x32 Top-Down Dark Cyber sin bordes)
  if (!scene.textures.exists('floor_tile')) {
    const floorG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Color base (piso contínuo)
    floorG.fillStyle(0x0f172a, 1);
    floorG.fillRect(0, 0, 32, 32);

    // Textura sutil: pequeños puntos o rayas para dar la sensación de alfombra industrial o material sin cuadrícula
    floorG.fillStyle(0x1e293b, 0.4);
    floorG.fillRect(4, 4, 4, 4);
    floorG.fillRect(20, 12, 4, 4);
    floorG.fillRect(8, 24, 4, 4);
    floorG.fillRect(28, 28, 2, 2);

    floorG.generateTexture('floor_tile', 32, 32);
    floorG.destroy();
  }

  // 1.b Baldosa del Lounge (32x32 Tonos cálidos/madera oscura sin bordes gruesos)
  if (!scene.textures.exists('lounge_tile')) {
    const loungeG = scene.make.graphics({ x: 0, y: 0, add: false });
    loungeG.fillStyle(0x18181b, 1); // Zin oscuro
    loungeG.fillRect(0, 0, 32, 32);
    
    // Líneas simulando tablas de madera (parqué contínuo sin bordes de celda)
    loungeG.lineStyle(1, 0x09090b, 0.5);
    loungeG.beginPath();
    // Alternar líneas para simular tablones
    loungeG.moveTo(8, 0); loungeG.lineTo(8, 32);
    loungeG.moveTo(24, 0); loungeG.lineTo(24, 32);
    
    // Separadores horizontales aleatorios para dar efecto de tablones
    loungeG.moveTo(0, 12); loungeG.lineTo(8, 12);
    loungeG.moveTo(8, 24); loungeG.lineTo(24, 24);
    loungeG.moveTo(24, 6); loungeG.lineTo(32, 6);

    loungeG.strokePath();

    loungeG.generateTexture('lounge_tile', 32, 32);
    loungeG.destroy();
  }

  // 1.c Baldosa de piso de Oficina de DÍA (Madera clara cálida)
  if (!scene.textures.exists('floor_tile_day')) {
    const floorDayG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Base madera clara (tono roble/haya cálido)
    floorDayG.fillStyle(0xd4b483, 1);
    floorDayG.fillRect(0, 0, 32, 32);

    // Tablones de madera con líneas sutiles
    floorDayG.lineStyle(1, 0xb89560, 0.55);
    floorDayG.beginPath();
    floorDayG.moveTo(8, 0); floorDayG.lineTo(8, 32);
    floorDayG.moveTo(24, 0); floorDayG.lineTo(24, 32);
    
    // Separadores horizontales alternados
    floorDayG.moveTo(0, 10); floorDayG.lineTo(8, 10);
    floorDayG.moveTo(8, 22); floorDayG.lineTo(24, 22);
    floorDayG.moveTo(24, 8); floorDayG.lineTo(32, 8);
    floorDayG.strokePath();

    // Vetas suaves
    floorDayG.fillStyle(0xe2caa0, 0.35);
    floorDayG.fillRect(2, 2, 4, 18);
    floorDayG.fillRect(12, 12, 6, 12);
    floorDayG.fillRect(26, 4, 4, 18);

    floorDayG.generateTexture('floor_tile_day', 32, 32);
    floorDayG.destroy();
  }

  // 1.d Baldosa del Lounge de DÍA (Madera gris claro)
  if (!scene.textures.exists('lounge_tile_day')) {
    const loungeDayG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Base madera gris claro
    loungeDayG.fillStyle(0xc9cbd1, 1);
    loungeDayG.fillRect(0, 0, 32, 32);

    // Tablones de madera en gris medio
    loungeDayG.lineStyle(1, 0xa3a7b0, 0.55);
    loungeDayG.beginPath();
    loungeDayG.moveTo(10, 0); loungeDayG.lineTo(10, 32);
    loungeDayG.moveTo(22, 0); loungeDayG.lineTo(22, 32);
    
    // Cortes de tablón
    loungeDayG.moveTo(0, 14); loungeDayG.lineTo(10, 14);
    loungeDayG.moveTo(10, 26); loungeDayG.lineTo(22, 26);
    loungeDayG.moveTo(22, 10); loungeDayG.lineTo(32, 10);
    loungeDayG.strokePath();

    // Vetas suaves grisáceas
    loungeDayG.fillStyle(0xdcdfe5, 0.35);
    loungeDayG.fillRect(2, 4, 6, 14);
    loungeDayG.fillRect(12, 8, 6, 16);
    loungeDayG.fillRect(24, 14, 6, 14);

    loungeDayG.generateTexture('lounge_tile_day', 32, 32);
    loungeDayG.destroy();
  }

  // Textura de Línea Neón (para el pasillo)
  if (!scene.textures.exists('neon_glow')) {
    const glowG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Gradiente suave circular para usar como partícula o overlay
    glowG.fillGradientStyle(0x38bdf8, 0x38bdf8, 0x38bdf8, 0x38bdf8, 1, 1, 0, 0);
    glowG.fillCircle(16, 16, 16);
    glowG.generateTexture('neon_glow', 32, 32);
    glowG.destroy();
  }

  // Textura de Escritorio (96x64 píxeles, para ocupar 3x2 celdas de 32px)
  if (!scene.textures.exists('desk_prop')) {
    const deskG = scene.make.graphics({ x: 0, y: 0, add: false });
    
    // Sombra proyectada
    deskG.fillStyle(0x000000, 0.4);
    deskG.fillRoundedRect(4, 4, 96, 64, 4);

    // Mesa de madera oscura
    deskG.fillStyle(0x1e293b, 1);
    deskG.fillRoundedRect(0, 0, 96, 64, 4);
    deskG.lineStyle(2, 0x0f172a, 1);
    deskG.strokeRoundedRect(0, 0, 96, 64, 4);

    // Separador central
    deskG.fillStyle(0x334155, 1);
    deskG.fillRect(0, 30, 96, 4);

    // --- Estación 1 (Arriba Izquierda) ---
    // Monitor
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRoundedRect(12, 18, 24, 6, 2);
    // Pantalla encendida
    deskG.fillStyle(0x0ea5e9, 0.8);
    deskG.fillRect(14, 20, 20, 2);
    // Teclado
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRect(16, 8, 16, 6);

    // --- Estación 2 (Arriba Derecha) ---
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRoundedRect(60, 18, 24, 6, 2);
    deskG.fillStyle(0x0ea5e9, 0.8);
    deskG.fillRect(62, 20, 20, 2);
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRect(64, 8, 16, 6);

    // --- Estación 3 (Abajo Izquierda) ---
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRoundedRect(12, 40, 24, 6, 2);
    deskG.fillStyle(0xf97316, 0.8);
    deskG.fillRect(14, 42, 20, 2);
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRect(16, 50, 16, 6);

    // --- Estación 4 (Abajo Derecha) ---
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRoundedRect(60, 40, 24, 6, 2);
    deskG.fillStyle(0xf97316, 0.8);
    deskG.fillRect(62, 42, 20, 2);
    deskG.fillStyle(0x0f172a, 1);
    deskG.fillRect(64, 50, 16, 6);

    // Plantitas o adornos en el centro
    deskG.fillStyle(0x22c55e, 1);
    deskG.fillCircle(48, 32, 6);
    deskG.fillStyle(0x166534, 1);
    deskG.fillCircle(48, 32, 3);

    deskG.generateTexture('desk_prop', 100, 68);
    deskG.destroy();
  }

  // Textura de Sofá Tipo U (128x64)
  if (!scene.textures.exists('sofa_u_prop')) {
    const sofaG = scene.make.graphics({ x: 0, y: 0, add: false });
    // Sombra
    sofaG.fillStyle(0x000000, 0.4);
    sofaG.fillRoundedRect(4, 4, 128, 64, 8);
    
    // Asiento
    sofaG.fillStyle(0x4c1d95, 1);
    sofaG.fillRoundedRect(0, 0, 128, 64, 8);
    // Espacio hueco (centro del sofá en U)
    sofaG.fillStyle(0x18181b, 1); // Color del lounge tile o transparente
    // Mejor hacerlo usando formas superpuestas
    sofaG.clear();
    // Sombra de los bloques
    sofaG.fillStyle(0x000000, 0.4);
    sofaG.fillRoundedRect(4, 4, 128, 32, 8); // Back
    sofaG.fillRoundedRect(4, 4, 32, 64, 8);  // Left arm
    sofaG.fillRoundedRect(100, 4, 32, 64, 8); // Right arm

    // Bloques del sofá (Morado moderno)
    sofaG.fillStyle(0x5b21b6, 1);
    sofaG.fillRoundedRect(0, 0, 128, 32, 8); // Back
    sofaG.fillRoundedRect(0, 0, 32, 64, 8);  // Left arm
    sofaG.fillRoundedRect(96, 0, 32, 64, 8); // Right arm

    // Cojines
    sofaG.fillStyle(0x4c1d95, 1);
    sofaG.fillRoundedRect(8, 8, 112, 20, 4);
    sofaG.fillRoundedRect(8, 8, 20, 50, 4);
    sofaG.fillRoundedRect(100, 8, 20, 50, 4);

    sofaG.generateTexture('sofa_u_prop', 132, 68);
    sofaG.destroy();
  }

  // Textura de Sofá Recto de 3 plazas (96x32)
  if (!scene.textures.exists('sofa_3_prop')) {
    const sofaG = scene.make.graphics({ x: 0, y: 0, add: false });
    sofaG.fillStyle(0x000000, 0.4);
    sofaG.fillRoundedRect(4, 4, 96, 32, 6);
    sofaG.fillStyle(0x6d28d9, 1);
    sofaG.fillRoundedRect(0, 0, 96, 32, 6);
    sofaG.fillStyle(0x5b21b6, 1);
    sofaG.fillRoundedRect(4, 4, 88, 14, 4); // Respaldo
    sofaG.generateTexture('sofa_3_prop', 100, 36);
    sofaG.destroy();
  }

  // Textura de Butaca (32x32)
  if (!scene.textures.exists('butaca_prop')) {
    const sofaG = scene.make.graphics({ x: 0, y: 0, add: false });
    sofaG.fillStyle(0x000000, 0.4);
    sofaG.fillRoundedRect(2, 2, 32, 32, 4);
    sofaG.fillStyle(0x9333ea, 1);
    sofaG.fillRoundedRect(0, 0, 32, 32, 4);
    sofaG.fillStyle(0x7e22ce, 1);
    sofaG.fillRoundedRect(4, 4, 24, 12, 4); // Respaldo
    sofaG.generateTexture('butaca_prop', 36, 36);
    sofaG.destroy();
  }

  // Textura de Sofá Gamer (48x64) - Orientado hacia la derecha (hacia la TV)
  if (!scene.textures.exists('sofa_gamer_prop')) {
    const sofaG = scene.make.graphics({ x: 0, y: 0, add: false });
    sofaG.fillStyle(0x000000, 0.4);
    sofaG.fillRoundedRect(4, 4, 48, 64, 8);
    sofaG.fillStyle(0xbe185d, 1); // Rosa/Rojo cyber
    sofaG.fillRoundedRect(0, 0, 48, 64, 8);
    // Respaldo en la izquierda (para que miren a la derecha)
    sofaG.fillStyle(0x9d174d, 1);
    sofaG.fillRoundedRect(4, 4, 16, 56, 6);
    sofaG.generateTexture('sofa_gamer_prop', 52, 68);
    sofaG.destroy();
  }
}

