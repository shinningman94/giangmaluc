"""Inpainting kit for every gender x standing pose: base image, OpenPose, lineart, region masks (512x1024)."""
import os, sys
from PIL import Image, ImageDraw
import modular as m
import poses as P
from compose3 import Rig

COLORS = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85],
          [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255],
          [255, 0, 255], [255, 0, 170], [255, 0, 85]]
LIMBS = [[2, 3], [2, 6], [3, 4], [4, 5], [6, 7], [7, 8], [2, 9], [9, 10], [10, 11], [2, 12], [12, 13], [13, 14],
         [2, 1], [1, 15], [15, 17], [1, 16], [16, 18]]

def opt(x, y, space="body"):
    with m.space(space):
        px, py = m.pt(x, y)
    return px / m.S, py / m.S

def openpose():
    R, L = m.arm_chain(-1), m.arm_chain(1)          # character's right arm is on the image left
    RL, LL = m.leg_chain(-1), m.leg_chain(1)
    kp = {0: opt(0, 214, "head"), 1: opt(0, 300), 2: opt(*R[0][:2]), 3: opt(*R[1][:2]), 4: opt(*R[2][:2]),
          5: opt(*L[0][:2]), 6: opt(*L[1][:2]), 7: opt(*L[2][:2]), 8: opt(*RL[0][:2]), 9: opt(*RL[1][:2]), 10: opt(*RL[2][:2]),
          11: opt(*LL[0][:2]), 12: opt(*LL[1][:2]), 13: opt(*LL[2][:2]),
          14: opt(-25, 192, "head"), 15: opt(25, 192, "head"), 16: opt(-58, 192, "head"), 17: opt(58, 192, "head")}
    img = Image.new("RGBA", (m.W, m.H), (0, 0, 0, 255)); ov = Image.new("RGBA", (m.W, m.H)); d = ImageDraw.Draw(ov)
    for i, (a, b) in enumerate(LIMBS): d.line([kp[a - 1], kp[b - 1]], fill=tuple(COLORS[i]) + (153,), width=8)
    img.alpha_composite(ov); d = ImageDraw.Draw(img)
    for i in range(18):
        x, y = kp[i]; d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=tuple(COLORS[i]))
    return img.convert("RGB")

def main(sheets, od):
    rig = Rig(sheets)
    for g in m.GENDERS:
        m.set_gender(g)
        for pose in rig.man["poses"]:
            name, fi = pose["id"], pose["frame"]
            P.set_pose(P.FRAMES[fi][2])
            k = os.path.join(od, g, name); os.makedirs(k, exist_ok=True)
            base = rig.frame(rig.look(g, "sang", None, hair=None, fx=False, expression="binh_thuong"), fi).resize((m.W, m.H), Image.NEAREST)
            for fn, col in (("base_white.png", (255, 255, 255, 255)), ("base_gray.png", (128, 128, 128, 255))):
                bg = Image.new("RGBA", (m.W, m.H), col); bg.alpha_composite(base); bg.convert("RGB").save(os.path.join(k, fn))
            g_ = Image.new("RGBA", (m.W, m.H), (255, 255, 255, 255)); g_.alpha_composite(base)
            g_.convert("L").point(lambda v: 0 if v < 105 else 255).save(os.path.join(k, "control_lineart.png"))
            openpose().save(os.path.join(k, "control_openpose.png"))
            with m.space("hair"):
                hm = m.head_mask()
                hair = m.M(m.grow(m.U(hm, m.rect(-90, 80, 90, 260)), 44), m.ell(0, 202, 44, 48))
            top = m.grow(m.U(m.yclip(m.torso_mask(), 262, 570), m.arms(), m.hands()), 20)
            bottom = m.yclip(m.grow(m.U(m.yclip(m.torso_mask(), 440, 620), m.legs()), 20), 0, 955)
            shoes = m.yclip(m.grow(m.U(m.legs(0.6, 1), m.feet()), 16), 720, 1010)
            full = m.M(m.U(top, bottom, shoes), m.grow(hm, 2))
            for n_, msk in (("mask_top", m.M(top, m.grow(hm, 2))), ("mask_bottom", bottom), ("mask_shoes", shoes),
                            ("mask_full_outfit", full), ("mask_hair", hair)):
                msk.resize((m.W, m.H), Image.NEAREST).save(os.path.join(k, n_ + ".png"))
        print("kit", g)
    m.set_gender("nu"); P.set_pose({})

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
