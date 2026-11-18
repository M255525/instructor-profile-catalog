# 產生 PWA 圖示：深藍履歷夾＋米白紙頁＋金色圓形頭像徽章＋文字線
import os
from PIL import Image, ImageDraw
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(out, exist_ok=True)

def draw(size, pad):
    s = 4 * size
    im = Image.new('RGB', (s, s), '#1B2433')
    d = ImageDraw.Draw(im)
    x0, x1 = pad * s, (1 - pad) * s
    w = x1 - x0
    px0, py0, px1, py1 = x0 + w * .2, x0 + w * .1, x1 - w * .2, x1 - w * .1
    d.rectangle([px0 + w * .03, py0 + w * .03, px1 + w * .03, py1 + w * .03], fill='#0E1420')
    d.rectangle([px0, py0, px1, py1], fill='#FBF8F1')
    pw = px1 - px0
    d.rectangle([px0, py0, px1, py0 + pw * .42], fill='#1F3A5F')
    d.rectangle([px0, py0 + pw * .42, px1, py0 + pw * .445], fill='#B8892E')
    cx, cy, r = px0 + pw * .5, py0 + pw * .42, pw * .2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='#B8892E')
    r2 = r * .82
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill='#FBF8F1')
    d.ellipse([cx - r2 * .38, cy - r2 * .62, cx + r2 * .38, cy + r2 * .1], fill='#1F3A5F')
    d.pieslice([cx - r2 * .7, cy + r2 * .05, cx + r2 * .7, cy + r2 * 1.4], 180, 360, fill='#1F3A5F')
    for i, yy in enumerate((.8, .92, 1.04, 1.16)):
        d.rectangle([px0 + pw * .14, py0 + pw * yy, px0 + pw * (.86 if i % 2 == 0 else .66), py0 + pw * yy + pw * .045], fill='#9AA0AB' if i else '#1F3A5F')
    return im.resize((size, size), Image.LANCZOS)

draw(192, .04).save(os.path.join(out, 'icon-192.png'))
draw(512, .04).save(os.path.join(out, 'icon-512.png'))
draw(512, .16).save(os.path.join(out, 'icon-maskable-512.png'))
print('ok')
