import numpy as np
from collections import deque
from PIL import Image, ImageFilter

SRC = 'images/partners/ptn_Guy.png'
OUT = 'images/partners/ptn_Guy_face.png'
T = 130
TOP = 2          # rows 0-1 are a black letterbox bar
RIGHT_CAP = 1000  # the head never legitimately reaches past x=995; beyond that is the fence
# jaw / chin bottom boundary, linear interpolation over these control points
BOTTOM = [(0, 905), (300, 905), (350, 882), (420, 905), (500, 940), (560, 952),
          (640, 935), (720, 900), (780, 872), (830, 882), (900, 905), (1080, 905)]

im = Image.open(SRC).convert('RGB')
full = np.asarray(im).astype(np.int32)
a = full[TOP:1071]
h, w, _ = a.shape
lum = a.mean(2)
dark = lum < T
dark[:, RIGHT_CAP + 1:] = False
dark[:, :2] = False

lab = np.zeros((h, w), np.int32)
cur = 0
for y in range(h):
    for x in range(w):
        if dark[y, x] and lab[y, x] == 0:
            cur += 1
            lab[y, x] = cur
            q = deque([(y, x)])
            while q:
                cy, cx = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = cur
                        q.append((ny, nx))

sizes = np.bincount(lab.ravel())
sizes[0] = 0
head = lab == int(np.argmax(sizes))
ys, xs = np.nonzero(head)
rmin = np.full(h, w, np.int32)
rmax = np.full(h, -1, np.int32)
np.minimum.at(rmin, ys, xs)
np.maximum.at(rmax, ys, xs)

# drop a thin dark sliver that sits outside a sunlit gap: the background fence is
# separated from the hair edge by bright pavement, while real hair is a wide dark band
GAP = 30
SLIVER = 60
WIN = 150


def trim_left(y, lo, hi):
    x = lo
    end = min(hi, lo + WIN)
    while x < end:
        if dark[y, x]:
            x += 1
            continue
        e = x
        while e < hi and not dark[y, e]:
            e += 1
        if e - x >= GAP and e - lo <= SLIVER:
            return e
        x = e
    return lo


def trim_right(y, lo, hi):
    x = hi
    end = max(lo, hi - WIN)
    while x > end:
        if dark[y, x]:
            x -= 1
            continue
        s = x
        while s > lo and not dark[y, s]:
            s -= 1
        if x - s >= GAP and hi - x <= SLIVER:
            return s
        x = s
    return hi


for y in range(h):
    if rmax[y] < 0:
        continue
    rmin[y] = trim_left(y, int(rmin[y]), int(rmax[y]))
    rmax[y] = trim_right(y, int(rmin[y]), int(rmax[y]))
    if rmax[y] < rmin[y]:
        rmin[y], rmax[y] = w, -1

rows_ok = np.nonzero(rmax >= 0)[0]
y0, y1 = int(rows_ok[0]), int(rows_ok[-1])
for arr in (rmin, rmax):
    raw = arr[y0:y1 + 1].astype(np.float64)
    half = 4
    pad = np.pad(raw, half, mode='edge')
    for i in range(raw.size):
        arr[y0 + i] = int(np.median(pad[i:i + 2 * half + 1]))

mask = np.zeros((h, w), bool)
for y in range(h):
    if rmax[y] >= 0:
        mask[y, rmin[y]:rmax[y] + 1] = True

mimg = Image.fromarray((mask * 255).astype(np.uint8))
mimg = mimg.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.MinFilter(25))
mimg = mimg.filter(ImageFilter.MinFilter(17)).filter(ImageFilter.MaxFilter(17))
mask = np.asarray(mimg) > 127

bx = [p[0] for p in BOTTOM]
by = [p[1] - TOP for p in BOTTOM]
bottom = np.interp(np.arange(w), bx, by)
mask &= np.arange(h)[:, None] <= bottom[None, :]

print('kept px', int(mask.sum()))
print('bounds', [(y + TOP, int(rmin[y]), int(rmax[y])) for y in range(698, 830, 12)])
alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
alpha = np.asarray(alpha).astype(np.int32)
alpha = np.clip((alpha - 40) * 255 // (255 - 80), 0, 255).astype(np.uint8)

rgba = np.dstack([a.astype(np.uint8), alpha])
out = Image.fromarray(rgba, 'RGBA')
bb = Image.fromarray((alpha > 0).astype(np.uint8) * 255).getbbox()
out = out.crop(bb)
out.save(OUT)
print('bbox', bb, 'size', out.size)

chk = np.asarray(out).astype(int)
print('corner alpha', chk[0, 0, 3], chk[0, -1, 3], chk[-1, 0, 3], chk[-1, -1, 3])
print('center alpha', chk[chk.shape[0] // 2, chk.shape[1] // 2, 3])
print('alpha hist', np.bincount(chk[:, :, 3].ravel(), minlength=256)[[0, 255]])

ov = a.copy()
ov[~mask] = (ov[~mask] * 0.25 + np.array([0, 255, 0]) * 0.75).astype(np.int32)
Image.fromarray(ov.astype(np.uint8)).resize((540, 534), Image.LANCZOS).save('_final_ov.png')
