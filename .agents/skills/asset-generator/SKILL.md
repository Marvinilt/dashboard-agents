---
name: asset-generator
description: Skill para generar, procesar y optimizar assets visuales 2D para la oficina virtual.
---

# Generador de Assets para la Oficina Virtual

Esta skill documenta y automatiza la creación e inserción de objetos 2D para tu entorno virtual.

## 1. Prompt Maestro Obligatorio

Cada vez que el usuario te solicite generar un nuevo objeto, **debes** usar estrictamente este prompt como base al invocar el `image-generator`:

> "Genera una imagen de [OBJETO]. Aplica estrictamente las siguientes reglas: 
> 1. Angulo de visión: Vista ortográfica 2D recta (alineación horizontal/vertical). NADA de perspectiva real (0 puntos de fuga). ESTRICTAMENTE PROHIBIDO generar vistas en diagonal (isométricas 3/4). ESTRICTAMENTE PROHIBIDO generar vistas frontales puras planas o cenitales (top-down 90°). El objeto debe estar siempre perfectamente alineado recto hacia la cámara (sin diagonales), con un ligero ángulo hacia arriba (abatido 75 grados) para que se aprecie su superficie y su frente. 
> 2. Estilo: Videojuego vintage, baja resolución (low-res) pero no completamente pixelado 8-bits. 
> 3. Aspecto: Estilo ilustrado de videojuego antiguo, bajo nivel de detalle, estrictamente NO realista. 
> 4. Fondo: Fondo blanco puro y sólido para facilitar el recorte automatizado."

## 2. Flujo de Trabajo

1. El usuario solicita un objeto.
2. Invocas al subagente `image-generator` con el prompt maestro + el objeto solicitado.
3. Muestras la imagen al usuario para su aprobación.
4. Una vez que el usuario la aprueba, ejecutas el script de post-procesamiento.

## 3. Post-Procesamiento y Compresión

El script elimina el fondo blanco (convirtiéndolo en transparencia), recorta el espacio vacío alrededor del objeto (bounding box) y comprime la imagen a `.png`.

**Comando de ejecución:**
```powershell
python ".agents/skills/asset-generator/scripts/process_asset.py" "<RUTA_IMAGEN_GENERADA>" "frontend/src/assets/objetos" "<NOMBRE_DEL_ASSET>"
```
