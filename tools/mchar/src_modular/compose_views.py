from PIL import Image
from compose3 import Rig
import os
def view_frame(r, L, d):
    back = d in (3, 4, 5)
    parts = [p for p in r.parts(L, 0) if p["slot"] != "fx" and p.get("viewSheet")]
    lay = []
    for p in parts:
        li, o = p["sortingLayerIndex"], p["orderInLayer"]
        if back:
            if p["slot"] == "face": continue
            if p["slot"] == "hair_front": li, o = 3, -2
            if p["slot"] == "hair_back": li, o = 3, -1
            if p["slot"] == "back": li, o = 2, 40
        lay.append(((li, o), p))
    lay.sort(key=lambda t: t[0])
    c = Image.new("RGBA", (128, 256), (0, 0, 0, 0))
    def crop(p):
        if p["viewSheet"] not in r._img: r._img[p["viewSheet"]] = Image.open(os.path.join(r.od, p["viewSheet"])).convert("RGBA")
        return r._img[p["viewSheet"]].crop((d * 128, 0, d * 128 + 128, 256))
    for _, p in lay: c.alpha_composite(crop(p))
    return c
if __name__ == "__main__":
    r = Rig("out3")
    looks = [r.look("nam", "sang", "kiem_tien", fx=False), r.look("nu", "sang", "du_hiep", fx=False), r.look("nu", "sang", "tien_nu", fx=False), r.look("nam", "ngam", "tuong_quan", fx=False)]
    im = Image.new("RGBA", (128 * 8, 256 * len(looks)), (0, 255, 0, 255))
    for y, L in enumerate(looks):
        for d in range(8): im.alpha_composite(view_frame(r, L, d), (d * 128, y * 256))
    im.save("out3/xem_truoc_360.png")
