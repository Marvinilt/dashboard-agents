import sys
import os
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, label

def remove_white_background(img, is_background=False):
    """
    Elimina el fondo blanco puro/sólido generado según las reglas de asset-generator,
    aplicando un suavizado anti-aliasing en los bordes y corrección de halo (de-fringing).
    """
    arr = np.array(img.convert('RGB'), dtype=np.float32)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    brightness = 0.299 * r + 0.587 * g + 0.114 * b
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c

    # Detección de blanco sólido
    is_pure_white = (brightness >= 242) & (sat <= 12)

    if is_background:
        # En fondos de arquitectura (perimetrales), se elimina la región conectada al centro (suelo)
        labeled, _ = label(is_pure_white)
        h, w = arr.shape[:2]
        center_comp = labeled[int(h * 0.6), int(w * 0.5)]
        white_mask = (labeled == center_comp) if center_comp > 0 else is_pure_white
    else:
        # En objetos, se eliminan todas las regiones blancas del fondo
        white_mask = is_pure_white

    # Dilatación suave de 2px para capturar el borde anti-aliased
    dilated_bg = binary_dilation(white_mask, iterations=2)
    border_zone = dilated_bg & (~white_mask)

    alpha = np.ones((arr.shape[0], arr.shape[1]), dtype=np.float32)
    alpha[white_mask] = 0.0

    # Suavizado de bordes
    t = np.clip((250.0 - brightness[border_zone]) / (250.0 - 120.0), 0.0, 1.0)
    alpha[border_zone] = t

    # De-fringe: descontaminar el blanco residual en el borde
    clean_rgb = arr[:,:,:3].copy()
    blend_mask = (alpha > 0.05) & (alpha < 0.98) & border_zone
    for c in range(3):
        clean_rgb[blend_mask, c] = np.clip(
            (clean_rgb[blend_mask, c] - (1.0 - alpha[blend_mask]) * 255.0) / np.maximum(alpha[blend_mask], 0.05),
            0.0, 255.0
        )

    rgba = np.dstack([clean_rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    out_img = Image.fromarray(rgba, 'RGBA')

    # Solo recortar bounding box si es un objeto (los backgrounds mantienen el encuadre)
    if not is_background:
        bbox = out_img.getbbox()
        if bbox:
            out_img = out_img.crop(bbox)

    return out_img

def process_image(input_path, output_dir, output_name, no_crop=False):
    print(f"Procesando imagen: {input_path}")
    
    try:
        input_img = Image.open(input_path)
        is_bg = no_crop or ("background" in output_dir.lower()) or ("fondo" in output_dir.lower())
        
        # Primero intentamos el extractor especializado de fondo blanco
        print("Eliminando fondo blanco y optimizando bordes...")
        output_img = remove_white_background(input_img, is_background=is_bg)
        
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{output_name}.png")
        
        output_img.save(output_path, "PNG", optimize=True)
        print(f"¡Éxito! Asset con fondo removido guardado en: {output_path}")
        return output_path

    except Exception as e:
        print(f"Ocurrió un error al procesar la imagen con extractor de fondo blanco: {e}")
        # Intentar fallback con rembg si está disponible
        try:
            from rembg import remove
            print("Intentando remoción con rembg como fallback...")
            output_img = remove(Image.open(input_path))
            if not is_bg:
                bbox = output_img.getbbox()
                if bbox:
                    output_img = output_img.crop(bbox)
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, f"{output_name}.png")
            output_img.save(output_path, "PNG", optimize=True)
            print(f"¡Éxito con rembg! Guardado en: {output_path}")
            return output_path
        except Exception as e2:
            print(f"Fallo definitivo: {e2}")
            return None

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Uso: python process_asset.py <ruta_imagen> <directorio_salida> <nombre_sin_extension> [--no-crop]")
        sys.exit(1)
        
    input_file = sys.argv[1]
    out_dir = sys.argv[2]
    out_name = sys.argv[3]
    no_crop_flag = "--no-crop" in sys.argv
    
    process_image(input_file, out_dir, out_name, no_crop=no_crop_flag)
