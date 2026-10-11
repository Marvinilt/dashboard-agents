import numpy as np
from PIL import Image

img = Image.open("frontend/src/assets/avatares/avatares_working_raw.png").convert("RGBA")
arr = np.array(img)
alpha = arr[:, :, 3]

# Check column profile (number of non-zero alpha pixels per column)
for row_idx, (y1, y2) in enumerate([(0, 768), (768, 1536)]):
    sub = alpha[y1:y2, :]
    col_counts = np.sum(sub > 10, axis=0)
    print(f"\n--- Row {row_idx} non-zero columns ---")
    # find continuous segments where col_counts > 0
    in_seg = False
    start = 0
    for x in range(img.width):
        if col_counts[x] > 10 and not in_seg:
            in_seg = True
            start = x
        elif col_counts[x] <= 10 and in_seg:
            in_seg = False
            print(f"Segment from x={start} to x={x-1} (width={x-start})")
    if in_seg:
        print(f"Segment from x={start} to x={img.width-1} (width={img.width-start})")
