"""360° view sheets: every part rendered standing in 8 directions (128x256 frames, 8 columns).

Directions: 0 xuống (front) · 1 chéo xuống-phải · 2 phải · 3 chéo lên-phải · 4 lên (back) · 5 chéo lên-trái · 6 trái · 7 chéo xuống-trái
5-7 are mirrors of 3-1. python3 build_views.py <out_dir>
"""
import json, os, sys
from PIL import Image, ImageChops
import modular as m
import build as B

VIEWS = ["front", "q", "side", "bq", "back"]
DIRS = [("front", False), ("q", False), ("side", False), ("bq", False), ("back", False), ("bq", True), ("side", True), ("q", True)]
DIR_NAMES = ["Xuống", "Chéo xuống phải", "Phải", "Chéo lên phải", "Lên", "Chéo lên trái", "Trái", "Chéo xuống trái"]
HAIR_SHIFT = {"side": (1, -3), "q": (1, -2), "bq": (0, -2)}

def set_view(v):
    m.POSE.update({"DX": 0.0, "DY": 0.0, "LIFT": 0.0, "arms": {}, "legs": {}, "weapon": None, "view": v, "eye_dx": 0.0})

def main(od):
    specs, _ = B.catalogue()
    man = json.load(open(os.path.join(od, "manifest.json"), encoding="utf-8"))
    ids = {p["id"] for p in man["parts"]}
    sheets = {}
    for v in VIEWS:
        set_view(v)
        rendered = {}
        for spec in specs:
            pid, slot = spec[0], spec[3]
            if slot in ("fx",) or pid not in ids: continue
            img, sl = B.render_spec(spec, "x")
            if v in HAIR_SHIFT and slot in ("hair_front", "hair_back"):
                f, b = HAIR_SHIFT[v]; img = ImageChops.offset(img, f if slot == "hair_front" else b, 0)
            rendered[pid] = img
            if sl is not None:
                sid = pid.replace("__", "_tay__") if "__" in pid else pid + "_tay"
                rendered[sid] = sl
        for d, (dv, fl) in enumerate(DIRS):
            if dv != v: continue
            for pid, img in rendered.items():
                sh = sheets.setdefault(pid, Image.new("RGBA", (128 * 8, 256), (0, 0, 0, 0)))
                sh.paste(img.transpose(Image.FLIP_LEFT_RIGHT) if fl else img, (d * 128, 0))
        print("view", v, len(rendered), flush=True)
    set_view("front"); m.set_gender("nu")
    for p in man["parts"]:
        if p["id"] in sheets:
            f = p["file"].replace("sheets/", "views/")
            os.makedirs(os.path.join(od, os.path.dirname(f)), exist_ok=True)
            sheets[p["id"]].save(os.path.join(od, f), optimize=True)
            p["viewSheet"] = f
    man["views"] = {"frame": {"w": 128, "h": 256}, "cols": 8,
                    "directions": [{"index": i, "name_vi": n, "view": DIRS[i][0], "mirrored": DIRS[i][1]} for i, n in enumerate(DIR_NAMES)],
                    "rules": {"back_views": "Directions 3,4,5: hide the face; draw hair_front in HairHat order -2 and hair_back in HairHat order -1 (so spikes/buns still show), and the back slot in ShirtArmor order 40.",
                              "side_views": "Directions 2 and 6 use a profile face and profile hair; no extra rules."}}
    json.dump(man, open(os.path.join(od, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main(sys.argv[1])
