import numpy as np
from PIL import Image

# Check developer_sprite.png frame 4 (sitting down)
dev_sprite = Image.open("frontend/src/assets/avatares/developer_sprite.png")
# developer_sprite has 4 cols, 2 rows: frameWidth = 688, frameHeight = 768
# Frame 4 is row 1, col 0 (x: 0..688, y: 768..1536)
f4 = dev_sprite.crop((0, 768, 688, 1536))
f4_alpha = np.array(f4)[:, :, 3]
f4_nz = np.argwhere(f4_alpha > 10)
print(f"developer_sprite frame 4 bbox in cell: min_y={f4_nz[:,0].min()}, max_y={f4_nz[:,0].max()}, height={f4_nz[:,0].max()-f4_nz[:,0].min()}")
print(f"bottom padding in cell: {768 - f4_nz[:,0].max()}")

# Check dev_desk_clean.png if exists
try:
    dev_desk = Image.open("frontend/src/assets/avatares/dev_desk_clean.png")
    dd_alpha = np.array(dev_desk)[:, :, 3]
    dd_nz = np.argwhere(dd_alpha > 10)
    print(f"dev_desk_clean size={dev_desk.size}, bbox: min_y={dd_nz[:,0].min()}, max_y={dd_nz[:,0].max()}, height={dd_nz[:,0].max()-dd_nz[:,0].min()}")
except Exception as e:
    print(f"dev_desk check: {e}")
