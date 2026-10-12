import os
import numpy as np
from PIL import Image

def build_working_spritesheet():
    raw_path = "frontend/src/assets/avatares/avatares_working_raw.png"
    out_path = "frontend/src/assets/avatares/avatares_working_sprite.png"
    
    img = Image.open(raw_path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    
    # 6 avatars defined by their row and horizontal segment
    # Mapping requested by user:
    # Row 0:
    #   Col 0 (Frame 0): QA
    #   Col 1 (Frame 1): Developer
    #   Col 2 (Frame 2): Diseñadora
    # Row 1:
    #   Col 0 (Frame 3): DBA
    #   Col 1 (Frame 4): Security
    #   Col 2 (Frame 5): Documenter
    
    avatar_definitions = [
        # (row_idx, col_idx, frame_idx, role_name, y_range, x_range)
        (0, 0, 0, "QA Tester", (0, 768), (430, 880)),
        (0, 1, 1, "Developer", (0, 768), (1150, 1600)),
        (0, 2, 2, "Diseñadora", (0, 768), (1910, 2330)),
        (1, 0, 3, "DBA", (768, 1536), (420, 880)),
        (1, 1, 4, "Security", (768, 1536), (1140, 1610)),
        (1, 2, 5, "Documenter", (768, 1536), (1880, 2360)),
    ]
    
    FRAME_W = 688
    FRAME_H = 768
    TOTAL_COLS = 3
    TOTAL_ROWS = 2
    TARGET_BOTTOM_Y = 720  # Matches standard sitting frame bottom (718px)
    
    out_img = Image.new("RGBA", (TOTAL_COLS * FRAME_W, TOTAL_ROWS * FRAME_H), (0, 0, 0, 0))
    
    for r_idx, c_idx, frame_idx, name, (y1, y2), (x1, x2) in avatar_definitions:
        sub_alpha = alpha[y1:y2, x1:x2]
        non_zeros = np.argwhere(sub_alpha > 10)
        
        if len(non_zeros) == 0:
            print(f"[-] Error: No pixels found for {name}")
            continue
            
        min_y, min_x = non_zeros.min(axis=0)
        max_y, max_x = non_zeros.max(axis=0)
        
        abs_min_x = x1 + min_x
        abs_max_x = x1 + max_x + 1
        abs_min_y = y1 + min_y
        abs_max_y = y1 + max_y + 1
        
        char_crop = img.crop((abs_min_x, abs_min_y, abs_max_x, abs_max_y))
        char_w, char_h = char_crop.size
        
        slot_x = c_idx * FRAME_W
        slot_y = r_idx * FRAME_H
        
        # Center horizontally in the 688 frame
        paste_x = slot_x + (FRAME_W - char_w) // 2
        # Align bottom edge to TARGET_BOTTOM_Y in the 768 frame
        paste_y = slot_y + TARGET_BOTTOM_Y - char_h
        
        out_img.paste(char_crop, (paste_x, paste_y), char_crop)
        print(f"Frame {frame_idx} [{name}]: crop=({abs_min_x},{abs_min_y},{abs_max_x},{abs_max_y}) size={char_w}x{char_h} -> pasted at ({paste_x}, {paste_y}) [cell: col={c_idx}, row={r_idx}]")
        
    out_img.save(out_path, "PNG")
    print(f"\n[+] Spritesheet successfully written to: {out_path}")
    print(f"    Dimensions: {out_img.size[0]}x{out_img.size[1]} ({TOTAL_COLS}x{TOTAL_ROWS} grid of {FRAME_W}x{FRAME_H}px)")

if __name__ == "__main__":
    build_working_spritesheet()
