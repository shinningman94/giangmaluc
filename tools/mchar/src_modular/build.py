"""Render every modular part into a 32-frame sprite sheet (8x4 frames of 128x256 px pixel art) + manifest v3.

python3 build.py <out_dir>
"""
import json, math, os, sys
from PIL import Image, ImageChops
import modular as m
import ancient as a
import poses as P

FW, FH, COLS, ROWS = 128, 256, 8, 4

SORT = {"Body": 0, "PantsSkirt": 1, "ShirtArmor": 2, "HairHat": 3}
SLOTS = {  # slot: (sorting layer, order, Vietnamese name)
    "back": ("Body", -20, "Sau lưng"), "hair_back": ("Body", -10, "Tóc (phần sau lưng)"),
    "body": ("Body", 0, "Cơ thể"), "face": ("Body", 10, "Biểu cảm"),
    "shoes": ("PantsSkirt", None, "Giày"), "bottom": ("PantsSkirt", 0, "Quần / váy"),
    "top": ("ShirtArmor", 0, "Áo"), "outer": ("ShirtArmor", 10, "Áo bào / giáp"), "neck": ("ShirtArmor", 14, "Khăn cổ"),
    "arms": ("ShirtArmor", 16, "Cánh tay"), "top_sleeve": ("ShirtArmor", 17, "Tay áo"), "outer_sleeve": ("ShirtArmor", 18, "Tay áo bào / giáp"),
    "accessory": ("ShirtArmor", 22, "Đồ đeo"), "hands": ("ShirtArmor", 25, "Bàn tay"), "weapon": ("ShirtArmor", 30, "Vũ khí"),
    "hair_front": ("HairHat", 0, "Tóc (phần trước)"), "hat": ("HairHat", 10, "Mũ / trang sức tóc"),
    "fx": ("HairHat", 40, "Hiệu ứng"),
}
UNISEX = {"hat", "pet", "hair_front", "hair_back", "fx"}
SPLIT = {"top": "top_sleeve", "outer": "outer_sleeve"}

# ---------------------------------------------------------------- body helpers
def skin_line(skin): return m.mix(m.dk(skin, 0.38), (60, 24, 30, 255), 0.4)

def arms_part(hx):
    skin = m.hexc(hx); img, _ = m.render(m.U(m.arms(), m.hands()), skin, line=skin_line(skin), shade=0.84, sd=(6, 4)); return img

def hands_part(hx):
    skin = m.hexc(hx); img, _ = m.render(m.hands(), skin, line=skin_line(skin), shade=0.84, sd=(4, 3)); return img

# ---------------------------------------------------------------- effects
def arc_band(cx, cy, r, w, a0, a1):
    ring = m.M(m.ell(cx, cy, r, r), m.ell(cx, cy, r - w, r - w))
    pts = [(cx, cy)] + [(cx + math.cos(math.radians(a0 + (a1 - a0) * k / 16)) * r * 1.3,
                         cy + math.sin(math.radians(a0 + (a1 - a0) * k / 16)) * r * 1.3) for k in range(17)]
    return m.I(ring, m.poly(pts))

def fx_frame(name):
    img = m.rgba_blank(); C1, C2 = m.hexc("#7ff0d4"), m.WHITE
    if name == "chem_1":
        (gx, gy), (dx, dy), L = a.weapon_grip(); tx, ty = gx + dx * L, gy + dy * L
        m.paint(img, a.star(tx, ty, 18, 5, 4), C2)
    elif name in ("chem_2", "chem_3", "chem_4"):
        rng = {"chem_2": (-160, 10, 1.0), "chem_3": (-120, 70, 1.0), "chem_4": (-40, 80, 0.5)}[name]
        band = arc_band(-60, 330, 230, 26, rng[0], rng[1])
        m.paint(img, band, C1, 0.85 * rng[2]); m.paint(img, arc_band(-60, 330, 222, 10, rng[0] + 20, rng[1]), C2, rng[2])
    elif name == "van_cong_1":
        m.paint(img, m.ell(0, 394, 34, 34), C1, 0.6); m.paint(img, m.ell(0, 394, 16, 16), C2, 0.9)
    elif name in ("van_cong_2", "van_cong_3"):
        r = 200 if name == "van_cong_2" else 240
        m.paint(img, m.M(m.ell(0, 420, r, r), m.ell(0, 420, r - 14, r - 14)), C1, 0.8)
        m.paint(img, m.M(m.ell(0, 420, r - 40, r - 40), m.ell(0, 420, r - 48, r - 48)), C2, 0.7)
    elif name in ("trung_don_0", "trung_don_1"):
        k = 1.0 if name.endswith("0") else 0.6
        m.paint(img, a.star(30, 380, 46 * k, 14 * k, 6), m.hexc("#ff5a4a")); m.paint(img, a.star(30, 380, 24 * k, 8 * k, 6), C2)
    elif name in ("thang_1", "thang_2"):
        hx, hy = m.hand_center(1)
        for k, (ox, oy) in enumerate([(-40, -30), (30, -50), (50, 10), (-50, 30), (0, -80)]):
            m.paint(img, a.star(hx + ox, hy + oy, 12 if k % 2 else 8, 3, 4), m.hexc("#ffe27a"))
    elif name in ("di_0", "di_3"):
        for s_ in (1, -1): m.paint(img, m.ell(s_ * 60, 975, 20, 7), m.hexc("#b8b0a0"), 0.55)
    return img

# ---------------------------------------------------------------- part catalogue (each spec renders one frame)
def catalogue():
    specs = []   # (id, base, gender, slot, name, fn, order, group, extra, links)
    for g, gn in m.GENDERS.items():
        for k, (nm, hx) in m.SKINS.items():
            specs.append((f"body_{k}__{g}", f"body_{k}", g, "body", f"{gn} – {nm}", (lambda hx=hx, g=g: m.body(hx, g)), None, None, {}, [f"arms_{k}", f"hands_{k}"]))
            specs.append((f"arms_{k}__{g}", f"arms_{k}", g, "arms", f"Cánh tay – {nm}", (lambda hx=hx: arms_part(hx)), None, None, {}, []))
            specs.append((f"hands_{k}__{g}", f"hands_{k}", g, "hands", f"Bàn tay – {nm}", (lambda hx=hx: hands_part(hx)), None, None, {}, []))
        for ex, exn in m.EXPRESSIONS.items():
            for k, (nm, hx) in m.EYES.items():
                specs.append((f"face_{ex}_{k}__{g}", f"face_{ex}_{k}", g, "face", f"{exn} – {nm}",
                              (lambda ex=ex, hx=hx, g=g: m.face(ex, hx, g)), None, None, {"expression": ex, "eyes": k}, []))
    for st in m.HAIR_STYLES:
        hname = m.hair_shapes(st)[0]
        for ck, (cn, hx) in m.HAIR_COLORS.items():
            for part, slot in (("front", "hair_front"), ("back", "hair_back")):
                idx = 1 if part == "front" else 2
                specs.append((f"hair_{st}_{ck}_{part}", f"hair_{st}_{ck}_{part}", None, slot, f"{hname} – {cn}",
                              (lambda st=st, hx=hx, idx=idx: m.hair(st, hx)[idx]), None, st, {"color": ck}, []))
    def add(base, slot, nm, fn, order, group):
        links = [f"{base}_tay"] if slot in SPLIT else []
        if slot in UNISEX: specs.append((base, base, None, slot, nm, fn, order, group, {}, links))
        else:
            for g in m.GENDERS: specs.append((f"{base}__{g}", base, g, slot, nm, fn, order, group, {}, links))
    for pid, slot, nm, fn, order in a.EXTRAS: add(pid, slot, nm, fn, order, "phu_kien")
    sets = []
    for sid, sname, pieces, look in a.OUTFITS:
        mapping = {}
        for slot, spec in pieces.items():
            if isinstance(spec, str): mapping[slot] = spec; continue
            nm, fn = spec[0], spec[1]; order = spec[2] if len(spec) > 2 else None
            add(f"{sid}_{slot}", slot, nm, fn, order, sid); mapping[slot] = f"{sid}_{slot}"
        sets.append({"id": sid, "name_vi": sname, "parts": mapping, "suggest": look})
    specs.append(("fx_hieu_ung", "fx_hieu_ung", None, "fx", "Hiệu ứng chiêu thức", None, None, "fx", {}, []))
    return specs, sets

def render_spec(spec, frame_name):
    pid, base, g, slot, nm, fn, order, group, extra, links = spec
    m.set_gender(g or "nu")
    with m.space("hair" if slot in ("hat",) else "body"):
        if slot == "fx": return fx_frame(frame_name), None
        if slot in SPLIT:
            m.SLEEVE_REC.append([]); full = fn(); rec = m.SLEEVE_REC.pop()
            m.ARMS_OFF[0] = True
            try: torso = fn()
            finally: m.ARMS_OFF[0] = False
            sleeve = m.rgba_blank()
            if rec:
                zone = m.grow(m.U(*rec), 6)
                sleeve = full.copy(); sleeve.putalpha(m.I(full.getchannel("A"), zone))
            return torso, sleeve
        return fn(), None

def main(od):
    specs, sets = catalogue()
    sheets = {}
    pet_cache = {}
    for fi, (fname, anim, pose, face) in enumerate(P.FRAMES):
        P.set_pose(pose)
        cx, cy = (fi % COLS) * FW, (fi // COLS) * FH
        for spec in specs:
            pid, slot = spec[0], spec[3]
            if slot == "pet":
                if pid not in pet_cache:
                    P.set_pose({}); pet_cache[pid] = render_spec(spec, fname)[0]; P.set_pose(pose)
                img = ImageChops.offset(pet_cache[pid], 0, round(2 * math.sin(fi * math.pi / 4))); sl = None
            else:
                img, sl = render_spec(spec, fname)
            sheets.setdefault(pid, Image.new("RGBA", (FW * COLS, FH * ROWS), (0, 0, 0, 0))).paste(img, (cx, cy))
            if sl is not None:
                sid = pid.replace("__", "_tay__") if "__" in pid else pid + "_tay"
                sheets.setdefault(sid, Image.new("RGBA", (FW * COLS, FH * ROWS), (0, 0, 0, 0))).paste(sl, (cx, cy))
        print(f"frame {fi:02d} {fname}", flush=True)
    m.set_gender("nu"); P.set_pose({})

    parts = []
    def entry(pid, base, g, slot, nm, order, group, extra, links, folder):
        layer, dorder, slot_vi = SLOTS[slot]
        f = f"sheets/{folder}/{pid}.png"
        os.makedirs(os.path.join(od, os.path.dirname(f)), exist_ok=True)
        sheets[pid].save(os.path.join(od, f), optimize=True)
        parts.append({"id": pid, "base": base, "gender": g, "slot": slot, "slot_vi": slot_vi, "name_vi": nm, "file": f,
                      "sortingLayer": layer, "sortingLayerIndex": SORT[layer], "orderInLayer": dorder if order is None else order,
                      "set": group, "links": links, **extra})
    for pid, base, g, slot, nm, fn, order, group, extra, links in specs:
        folder = {"body": "base", "arms": "base", "hands": "base", "face": "face", "hair_front": "hair", "hair_back": "hair"}.get(slot) or (group if group and group not in ("phu_kien",) else "phu_kien")
        entry(pid, base, g, slot, nm, order, group, extra, links, folder)
        if slot in SPLIT:
            sid = pid.replace("__", "_tay__") if "__" in pid else pid + "_tay"
            entry(sid, base + "_tay", g, SPLIT[slot], nm + " (tay áo)", None, group, {}, [], folder)
    frames = [{"index": i, "name": n, "anim": an, "face": fc, "col": i % COLS, "row": i // COLS} for i, (n, an, _, fc) in enumerate(P.FRAMES)]
    anims = [{"id": aid, "name_vi": nm, "fps": fps, "loop": loop, "frames": [f["index"] for f in frames if f["anim"] == aid]}
             for aid, nm, fps, loop in P.ANIMS]
    man = {
        "format": "modular-character.v3",
        "frame": {"w": FW, "h": FH}, "sheet": {"cols": COLS, "rows": ROWS, "w": FW * COLS, "h": FH * ROWS, "order": "row-major", "origin": "top-left"},
        "pixelsPerUnit": 64, "pivot": {"x": 0.5, "y": round(1 - m.GROUND / m.H, 4), "note": "Pivot (bottom-left origin) at the feet, the same for every frame and part."},
        "frames": frames, "animations": anims,
        "poses": [{"id": n, "name_vi": P.POSE_NAMES[n], "frame": i} for i, (n, an, _, _) in enumerate(P.FRAMES) if an == "pose"],
        "genders": [{"id": k, "name_vi": v} for k, v in m.GENDERS.items()],
        "expressions": [{"id": k, "name_vi": v} for k, v in m.EXPRESSIONS.items()],
        "eyeColors": [{"id": k, "name_vi": v[0], "hex": v[1]} for k, v in m.EYES.items()],
        "skins": [{"id": k, "name_vi": v[0], "hex": v[1]} for k, v in m.SKINS.items()],
        "hairStyles": [{"id": st, "name_vi": m.hair_shapes(st)[0]} for st in m.HAIR_STYLES],
        "hairColors": [{"id": k, "name_vi": v[0], "hex": v[1]} for k, v in m.HAIR_COLORS.items()],
        "sortingLayers": [{"name": n, "index": i} for n, i in SORT.items()],
        "slots": {k: {"sortingLayer": v[0], "orderInLayer": v[1], "name_vi": v[2]} for k, v in SLOTS.items()},
        "notes": {"ids": "Gendered parts: '<base>__nam' / '<base>__nu'. Sets list base ids; resolve with the current gender, else the base id.",
                  "links": "Equipping a part also equips its links (body -> arms + hands, top/outer -> their sleeve layer).",
                  "layers": "Arms, sleeves and hands sit above the clothing torso inside Shirt/Armor so arms crossing the chest stay in front.",
                  "face": "Frames may name a 'face' expression to show during that frame (e.g. 'dau' while hurt)."},
        "outfitSets": sets, "parts": parts,
    }
    json.dump(man, open(os.path.join(od, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(parts), "sheets")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "out3")
