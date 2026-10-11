import sys
import os

try:
    import onnxruntime
    from PIL import Image
    from rembg import remove
except ImportError:
    print("Instalando la librería 'rembg' con soporte para CPU...")
    # Es necesario instalar la versión con soporte de CPU (o GPU)
    os.system(f'{sys.executable} -m pip install "rembg[cpu]" Pillow')
    import onnxruntime
    from PIL import Image
    from rembg import remove

def process_image(input_path, output_dir, output_name):
    print(f"Procesando imagen original: {input_path}")
    
    try:
        input_img = Image.open(input_path)
        
        print("Removiendo fondo con IA (puede tardar unos segundos la primera vez al descargar el modelo)...")
        # remove() automáticamente detecta el objeto central y remueve el fondo
        output_img = remove(input_img)
        
        # Recortar el espacio vacío
        bbox = output_img.getbbox()
        if bbox:
            output_img = output_img.crop(bbox)
        
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{output_name}.png")
        
        output_img.save(output_path, "PNG", optimize=True)
        print(f"¡Éxito! Asset con fondo removido y optimizado en: {output_path}")

    except Exception as e:
        print(f"Ocurrió un error al procesar la imagen: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Uso: python process_asset.py <ruta_imagen> <directorio_salida> <nombre_sin_extension>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    out_dir = sys.argv[2]
    out_name = sys.argv[3]
    
    process_image(input_file, out_dir, out_name)
