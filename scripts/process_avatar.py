import sys
import os
from rembg import remove
from PIL import Image

def process_avatar(input_path, output_path):
    print(f"==========================================")
    print(f" Procesando Avatar: {os.path.basename(input_path)}")
    print(f"==========================================")
    
    try:
        # 1. Abrir la imagen
        input_image = Image.open(input_path)
        print(f"[*] Imagen original cargada ({input_image.size[0]}x{input_image.size[1]}px)")
        
        # 2. Quitar el fondo usando IA (rembg)
        print("[*] Removiendo fondo blanco usando IA... (esto puede tomar unos segundos)")
        output_image = remove(input_image)
        
        # 3. Guardar el resultado
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        output_image.save(output_path, "PNG")
        print(f"[+] ¡Éxito! Sprite sheet transparente guardado en:\n    -> {output_path}")
        
    except Exception as e:
        print(f"[-] Error crítico: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python process_avatar.py <ruta_entrada_imagen> <ruta_salida_png>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"[-] El archivo de entrada no existe: {input_file}")
        sys.exit(1)
        
    process_avatar(input_file, output_file)
