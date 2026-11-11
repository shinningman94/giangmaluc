"""Cel-shaded 2x layer atlases for the cổ trang character creator (v16.51).
python3 gen_layers2.py <tools_dir> <out_dir> <worker> <nworkers>
Each part -> <out>/mc/<pid>.png (trimmed frames shelf-packed) + <pid>.json {f:[[x,y,w,h,ox,oy]|0 x54], s:{...} sleeves}
"""
import sys, os, json, time
TOOLS, OUT = sys.argv[1], sys.argv[2]
WI, WN = int(sys.argv[3]), int(sys.argv[4])
sys.path.insert(0, TOOLS); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageChops
import anim35 as A
import modular as m
import build as B
import cel
SSI, K = 4, 2
cel.enable(SSI)
ANIMS = ['cho_phai', 'di_phai', 'chem_phai', 'trung_don', 'chien_thang', 'cho_xuong', 'om_quyen']
CX0, CY0, FW, FH = 16 * K, 4 * K, 232 * K, 244 * K
GA = A.GROUND_ART * K
AW = 2048

def frames_of():
    out = []
    for aid, name, d, fps, loop, fn, combat in A.ANIMS:
        if aid not in ANIMS: continue
        out.append((aid, fps, loop, combat, fn()))
    out.sort(key=lambda t: ANIMS.index(t[0]))
    return out

def render_layer(spec, pose, view):
    A.set_pose(pose)
    img, sleeve = B.render_spec(spec, 'x')
    img, sleeve = cel.down(img, K), cel.down(sleeve, K)
    if view == 'side' and spec[3] in ('hair_back', 'hair_front'):
        img = ImageChops.offset(img, (-3 if spec[3] == 'hair_back' else 1) * K, 0)
    return img, sleeve

def place(img):
    fr = Image.new('RGBA', (256 * K, 256 * K), (0, 0, 0, 0)); ch = img.copy()
    ch.paste((0, 0, 0, 0), (0, GA, ch.width, ch.height))
    fr.alpha_composite(ch, ((256 * K - ch.width) // 2, 0))
    return fr.crop((CX0, CY0, CX0 + FW, CY0 + FH))

def pack(frames):
    """frames: list of Image|None (FW x FH) -> atlas, rects"""
    cut = []
    for f in frames:
        bb = f.getbbox() if f is not None else None
        if not bb: cut.append(None); continue
        bb = (max(0, bb[0] - 1), max(0, bb[1] - 1), min(FW, bb[2] + 1), min(FH, bb[3] + 1))
        cut.append((f.crop(bb), bb))
    if not any(cut): return None, None
    order = sorted([i for i, c in enumerate(cut) if c], key=lambda i: -cut[i][0].height)
    x = y = rowh = 0; pos = {}
    for i in order:
        im = cut[i][0]
        if x + im.width > AW: x = 0; y += rowh; rowh = 0
        pos[i] = (x, y); x += im.width; rowh = max(rowh, im.height)
    W = max(pos[i][0] + cut[i][0].width for i in pos); H = y + rowh
    at = Image.new('RGBA', (W, H), (0, 0, 0, 0)); rects = []
    for i, c in enumerate(cut):
        if not c: rects.append(0); continue
        im, bb = c; px, py = pos[i]; at.paste(im, (px, py))
        rects.append([px, py, im.width, im.height, bb[0], bb[1]])
    return at, rects

def main():
    A.widen()
    by, sets = A.specs()
    anims = frames_of()
    flat = [(aid, p, e, combat) for aid, fps, loop, combat, fr in anims for p, e, mt in fr]
    os.makedirs(os.path.join(OUT, 'mc'), exist_ok=True)
    jobs = []
    for sid, spec in by.items():
        slot = spec[3]
        if slot == 'fx': continue
        if slot == 'face' and spec[8]['expression'] != 'binh_thuong': continue
        jobs.append(spec)
    jobs.sort(key=lambda s: s[0])
    t0 = time.time()
    for ji, spec in enumerate(jobs):
        if ji % WN != WI: continue
        pid = spec[0]
        if os.path.exists(os.path.join(OUT, 'mc', pid + '.json')): continue
        g = spec[2]; is_face = spec[3] == 'face'
        fa, fs = [], []
        for i, (aid, pose, expr, combat) in enumerate(flat):
            sp = spec
            if is_face: sp = by.get(f"face_{expr}_{spec[8]['eyes']}__{g}")
            m.set_gender(g or 'nu')
            img, sleeve = render_layer(sp, pose, pose.get('view', 'front'))
            m.set_gender('nu')
            fa.append(place(img)); fs.append(place(sleeve) if sleeve is not None else None)
        ent = {}
        at, r = pack(fa)
        if at: at.save(os.path.join(OUT, 'mc', pid + '.png'), optimize=True); ent['f'] = r
        at, r = pack(fs)
        if at: at.save(os.path.join(OUT, 'mc', pid + '_s.png'), optimize=True); ent['s'] = r
        json.dump(ent, open(os.path.join(OUT, 'mc', pid + '.json'), 'w'))
        print(WI, pid, round(time.time() - t0), flush=True)

main()
