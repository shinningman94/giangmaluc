"""Render per-part layer atlases of the modular cổ trang character for the game's character creator.
Uses anim35.py (animation poses, side/front views) + build.py catalogue (modular parts).
python3 gen_layers.py <tools_dir> <out_dir> [part_filter]
Each part -> <out>/mc/<pid>.png : grid COLS x ROWS of FW x FH frames (crop box of the 256x256 anim frame).
Index -> <out>/mc.json
"""
import sys, os, json, time
TOOLS, OUT = sys.argv[1], sys.argv[2]
FILT = sys.argv[3] if len(sys.argv) > 3 else ''
sys.path.insert(0, TOOLS)
from PIL import Image, ImageChops
import anim35 as A
import modular as m
import build as B

ANIMS = ['cho_phai', 'di_phai', 'chem_phai', 'trung_don', 'chien_thang', 'cho_xuong', 'om_quyen']
CX0, CY0, FW, FH = 16, 4, 232, 244
COLS = 9

def frames_of():
    out = []
    for aid, name, d, fps, loop, fn, combat in A.ANIMS:
        if aid not in ANIMS: continue
        fr = fn()
        for p, e, meta in fr: assert not meta.get('rot') and not meta.get('flip'), aid
        out.append((aid, fps, loop, combat, fr))
    out.sort(key=lambda t: ANIMS.index(t[0]))
    return out

def render_layer(spec, pose, view):
    A.set_pose(pose)
    img, sleeve = B.render_spec(spec, 'x')
    if view == 'side' and spec[3] in ('hair_back', 'hair_front'):
        img = ImageChops.offset(img, -3 if spec[3] == 'hair_back' else 1, 0)
    return img, sleeve

def place(img):
    fr = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); ch = img.copy()
    ch.paste((0, 0, 0, 0), (0, A.GROUND_ART, ch.width, 256))
    fr.alpha_composite(ch, ((256 - ch.width) // 2, 0))
    return fr.crop((CX0, CY0, CX0 + FW, CY0 + FH))

def main():
    A.widen()
    by, sets = A.specs()
    anims = frames_of()
    flat = [(aid, p, e, combat) for aid, fps, loop, combat, fr in anims for p, e, mt in fr]
    N = len(flat); ROWS = (N + COLS - 1) // COLS
    os.makedirs(os.path.join(OUT, 'mc'), exist_ok=True)
    # which specs: body/arms/hands, faces (per gender+eyes: expression follows frame), hair, outfit parts, weapons
    jobs = []
    for sid, spec in by.items():
        slot = spec[3]
        if slot in ('fx',): continue
        if slot == 'face':
            ex = spec[8]['expression']
            if ex != 'binh_thuong': continue      # one face layer per gender/eyes, expression taken per frame
        jobs.append(spec)
    idx = {'frame': {'w': FW, 'h': FH, 'cols': COLS, 'rows': ROWS, 'crop': [CX0, CY0], 'feet': A.GROUND_ART - CY0},
           'anims': [], 'parts': {}, 'sets': sets,
           'hair': list(m.HAIR_STYLES), 'hairColors': {k: v[1] for k, v in m.HAIR_COLORS.items()},
           'eyes': {k: v[1] for k, v in m.EYES.items()}, 'skins': {k: v[1] for k, v in m.SKINS.items()}}
    k = 0
    for aid, fps, loop, combat, fr in anims:
        idx['anims'].append({'id': aid, 'fps': fps, 'loop': loop, 'from': k, 'n': len(fr), 'combat': combat}); k += len(fr)
    t0 = time.time()
    for spec in jobs:
        pid = spec[0]
        if FILT and FILT not in pid: continue
        g = spec[2]
        is_face = spec[3] == 'face'
        sheet = Image.new('RGBA', (FW * COLS, FH * ROWS), (0, 0, 0, 0)); sl = None
        for i, (aid, pose, expr, combat) in enumerate(flat):
            sp = spec
            if is_face:
                eyes = spec[8]['eyes']; sp = by.get(f"face_{expr}_{eyes}__{g}")
            m.set_gender(g or 'nu')
            img, sleeve = render_layer(sp, pose, pose.get('view', 'front'))
            m.set_gender('nu')
            x, y = (i % COLS) * FW, (i // COLS) * FH
            sheet.alpha_composite(place(img), (x, y))
            if sleeve is not None:
                if sl is None: sl = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
                sl.alpha_composite(place(sleeve), (x, y))
        key = A.layer_key(spec, 'front')
        ent = {'slot': spec[3], 'key': list(key), 'g': g}
        if sheet.getbbox():
            sheet.save(os.path.join(OUT, 'mc', pid + '.png'), optimize=True); ent['f'] = 1
        if sl is not None and sl.getbbox():
            sl.save(os.path.join(OUT, 'mc', pid + '_s.png'), optimize=True)
            sk = B.SLOTS[B.SPLIT[spec[3]]]; ent['s'] = [B.SORT[sk[0]], sk[1]]
        idx['parts'][pid] = ent
        print(pid, round(time.time() - t0, 1), flush=True)
    if not FILT:
        json.dump(idx, open(os.path.join(OUT, 'mc.json'), 'w', encoding='utf-8'), ensure_ascii=False)

main()
