"""35 smooth pixel-art animations for a modular character, in 4 directions, on chroma green.

python3 anim35.py <sheets_or_out_dir> <character_id>
Outputs per animation: <id>.png (sheet on green), <id>_alpha.png (transparent), <id>.gif (preview x3)
"""
import json, math, os, sys
from PIL import Image, ImageChops
import modular as m
import ancient as a
import build as B

FW = FH = 256                     # frame size (art px); the 128x256 character stands in the middle
GREEN = (0, 255, 0, 255)
GROUND_ART = 248                  # pixels below this row are cleared (sitting / kneeling robes stop at the floor)
PI = math.pi

# ---------------------------------------------------------------- characters
CHARS = {
    "kiem_tien_nam": dict(gender="nam", skin="sang", eyes="nau", hair="kiem_tien", color="den", outfit="kiem_tien", weapon="kiem_ngoc",
                          name="Kiếm tiên thanh y (nam)"),
    "du_hiep_nu": dict(gender="nu", skin="sang", eyes="nau", hair="co_trang_nu", color="lam", outfit="du_hiep", weapon="kiem_bua",
                       name="Thiếu niên du hiệp (nữ)"),
}

SPECS = None
def specs():
    global SPECS
    if SPECS is None:
        sp, sets = B.catalogue()
        SPECS = ({s[0]: s for s in sp}, {s["id"]: s for s in sets})
    return SPECS

def resolve(base, g):
    by, _ = specs()
    return by.get(f"{base}__{g}") or by.get(base)

# ---------------------------------------------------------------- pose helpers
def set_pose(p):
    m.POSE.update({"DX": 0.0, "DY": 0.0, "LIFT": 0.0, "arms": {}, "legs": {}, "weapon": None, "view": "front", "eye_dx": 0.0})
    m.POSE.update(p)

def lerp(a_, b_, u): return a_ + (b_ - a_) * u
def lerp2(p, q, u): return (lerp(p[0], q[0], u), lerp(p[1], q[1], u))
def mix_limbs(A, Bm, u):
    out = {}
    for s in (1, -1):
        if s in A or s in Bm:
            a0 = A.get(s); b0 = Bm.get(s)
            if a0 and b0: out[s] = (lerp2(a0[0], b0[0], u), lerp2(a0[1], b0[1], u))
            else: out[s] = a0 or b0
    return out

def ground(legs):
    """LIFT (output px, negative = lower the body) so the lowest ankle stands on the floor."""
    ys = [v[1][1] for v in legs.values()] or [935]
    lowest = max(ys + ([935] if len(legs) < 2 else []))
    return -(935 - lowest) * m.BODY_SY

DEF_ARMS = {1: ((96, 465), (112, 592)), -1: ((-96, 465), (-112, 592))}
DEF_LEGS = {1: ((40, 770), (43, 935)), -1: ((-40, 770), (-43, 935))}
SIT_LEGS = {1: ((100, 600), (-24, 612)), -1: ((-100, 600), (24, 616))}
SIT_ARMS = {1: ((96, 440), (90, 560)), -1: ((-96, 440), (-90, 560))}
MED_ARMS = {1: ((88, 450), (14, 522)), -1: ((-88, 450), (-14, 522))}
KNEEL_LEGS = {1: ((52, 650), (56, 800)), -1: ((-40, 800), (-46, 812))}
KNEEL2_LEGS = {1: ((40, 800), (44, 812)), -1: ((-40, 800), (-44, 812))}

def breathe(i, n, amp=5): return amp * (1 - math.cos(2 * PI * i / n)) / 2

# side-view kinematics (facing right = +x forward)
def side_legs(p, amp, bend, lift_mult=1.0):
    legs = {}
    for s in (1, -1):
        ph = p + (0 if s == 1 else PI)
        th = amp * math.sin(ph)
        hx = s * 8
        kx, ky = hx + 210 * math.sin(th), 560 + 210 * math.cos(th)
        bv = bend * max(0.0, math.cos(ph)) * lift_mult
        ph2 = th - bv
        legs[s] = ((kx, ky), (kx + 165 * math.sin(ph2), ky + 165 * math.cos(ph2)))
    return legs

def side_arms(p, amp, fbend):
    arms = {}
    for s in (1, -1):
        al = -amp * math.sin(p + (0 if s == 1 else PI))
        ex, ey = s * 6 + 147 * math.sin(al), 318 + 147 * math.cos(al)
        arms[s] = ((ex, ey), (ex + 127 * math.sin(al + fbend), ey + 127 * math.cos(al + fbend)))
    return arms

def front_walk_limbs(i, n, lift_amt=1.0, arm_amt=1.0):
    p = 2 * PI * i / n; sp = math.sin(p)
    legs = {}
    for s, l in ((1, max(0, sp)), (-1, max(0, -sp))):
        if l > 0.02: legs[s] = ((s * 38, 770 - 26 * l * lift_amt), (s * 36, 935 - 40 * l * lift_amt))
    sw = sp * arm_amt
    arms = {1: ((98, 462 - 8 * sw), (114 + 3 * sw, 588 - 14 * sw)), -1: ((-98, 462 + 8 * sw), (-114 - 3 * sw, 588 + 14 * sw))}
    return legs, arms, -4 * abs(sp) * lift_amt

# ---------------------------------------------------------------- animation list: each returns frames [(pose, expr, meta)]
def F(pose=None, expr="nghiem", **meta): return (pose or {}, expr, meta)

def blink(i, n, at=None): return "nham_mat" if i == (at if at is not None else n - 2) else None

def anim_idle(view):
    n = 8
    return [F({"view": view, "DY": breathe(i, n)}, blink(i, n) or "nghiem") for i in range(n)]

def anim_walk(view):
    n = 8; fr = []
    for i in range(n):
        if view == "side":
            p = 2 * PI * i / n
            legs = side_legs(p, 0.38, 0.75); arms = side_arms(p, 0.42, 0.25)
            fr.append(F({"view": "side", "legs": legs, "arms": arms, "LIFT": ground(legs), "DX": 2}))
        else:
            legs, arms, dy = front_walk_limbs(i, n)
            fr.append(F({"view": view, "legs": legs, "arms": arms, "DY": dy}))
    return fr

def anim_run(view):
    n = 8; fr = []
    for i in range(n):
        p = 2 * PI * i / n
        air = 10 * max(0, math.sin(2 * p))
        if view == "side":
            legs = side_legs(p, 0.62, 1.5); arms = side_arms(p, 0.75, 1.3)
            fr.append(F({"view": "side", "legs": legs, "arms": arms, "LIFT": ground(legs) + air, "DX": 10}, "lanh_lung"))
        else:
            legs, _, dy = front_walk_limbs(i, n, 1.8, 0)
            sw = math.sin(p)
            arms = {1: ((112, 430), (78 + 10 * sw, 470 - 40 * sw)), -1: ((-112, 430), (-78 + 10 * sw, 470 + 40 * sw))}
            fr.append(F({"view": view, "legs": legs, "arms": arms, "DY": dy + 6, "LIFT": air}, "lanh_lung"))
    return fr

def anim_fidget():
    n = 16; fr = []
    dxs = [0, 2, 4, 5, 5, 4, 2, 0, -2, -4, -5, -5, -4, -2, 0, 0]
    eyes = [0, 0, 0, 6, 10, 10, 6, 0, 0, 0, -6, -10, -10, -6, 0, 0]
    for i in range(n):
        arms = {1: ((100, 462), (118, 586 - 6 * max(0, math.sin(2 * PI * i / n))))}
        fr.append(F({"DX": dxs[i], "DY": breathe(i, 8, 4), "eye_dx": eyes[i], "arms": arms}, "nham_mat" if i == 8 else "nghiem"))
    return fr

def anim_look():
    n = 12; ex = [0, -8, -14, -14, -14, -8, 0, 8, 14, 14, 8, 0]
    return [F({"eye_dx": ex[i], "DX": ex[i] * 0.2, "DY": breathe(i, n, 3)}, "nghiem") for i in range(n)]

TALK_MOUTH = ["noi", "nghiem", "noi", "noi", "nghiem", "noi", "nghiem", "nghiem"]
def anim_talk(view):
    n = 8; fr = []
    for i in range(n):
        g = math.sin(2 * PI * i / n)
        if view == "side":
            arms = {1: ((40, 430), (110 + 10 * g, 450 - 10 * g)), -1: ((-4, 465), (6, 592))}
        else:
            arms = {1: ((112, 440), (84 + 8 * g, 470 - 10 * g))}
        fr.append(F({"view": view, "arms": arms, "DY": breathe(i, n, 3)}, TALK_MOUTH[i]))
    return fr

def anim_stern():
    n = 8; HIPS = {1: ((126, 420), (72, 482)), -1: ((-126, 420), (-72, 482))}
    return [F({"arms": HIPS, "legs": {1: ((48, 770), (56, 935)), -1: ((-48, 770), (-56, 935))}, "DY": breathe(i, n, 4)},
              "nham_mat" if i == 5 else "nghiem") for i in range(n)]

def anim_laugh():
    n = 8
    return [F({"arms": {1: ((90, 450), (30, 500)), -1: ((-90, 450), (-30, 500))}, "DY": 6 * abs(math.sin(2 * PI * i / 4)),
               "DX": 2 * math.sin(2 * PI * i / n)}, "cuoi") for i in range(n)]

def sit_pose(u, arms_to=SIT_ARMS):
    legs = mix_limbs(DEF_LEGS, SIT_LEGS, u)
    arms = mix_limbs(DEF_ARMS, arms_to, u)
    dy = 10 * math.sin(PI * u)        # bend forward while moving
    return {"legs": legs, "arms": arms, "LIFT": ground(legs), "DY": dy}

def anim_sit_down():
    n = 6; return [F(sit_pose(i / (n - 1)), "nghiem") for i in range(n)]

def anim_stand_up():
    n = 6; return [F(sit_pose(1 - i / (n - 1)), "nghiem") for i in range(n)]

def anim_sit_idle():
    n = 8; return [F({**sit_pose(1), "DY": breathe(i, n, 4)}, blink(i, n) or "nghiem") for i in range(n)]

def anim_meditate():
    n = 8; return [F({**sit_pose(1, MED_ARMS), "DY": breathe(i, n, 5)}, "nham_mat") for i in range(n)]

def anim_sleep():
    n = 8; return [F({"DY": breathe(i, n, 6)}, "nham_mat", rot=90) for i in range(n)]

def kneel_pose(legs=KNEEL_LEGS, arms=None, dy=0):
    return {"legs": legs, "arms": arms or {1: ((92, 450), (62, 560)), -1: ((-96, 465), (-110, 590))}, "LIFT": ground(legs), "DY": dy}

def anim_kneel():
    n = 6; return [F({**kneel_pose(), "DY": 6 + breathe(i, n, 4)}, "nghiem") for i in range(n)]

def anim_fall():
    hurt = lambda dx: {"DX": dx, "arms": {1: ((104, 400), (122, 350)), -1: ((-104, 400), (-122, 350))}}
    return [F(hurt(-8), "dau"), F(hurt(-14), "dau"), F(hurt(-18), "dau"),
            F(kneel_pose(KNEEL2_LEGS, {1: ((100, 440), (100, 560)), -1: ((-100, 440), (-100, 560))}, 14), "dau"),
            F(kneel_pose(KNEEL2_LEGS, {1: ((100, 440), (100, 560)), -1: ((-100, 440), (-100, 560))}, 24), "dau"),
            F({"DY": 0}, "nham_mat", rot=45), F({"DY": 0}, "nham_mat", rot=80), F({"DY": 0}, "nham_mat", rot=90)]

def anim_get_up():
    return [F({}, "nham_mat", rot=90), F({}, "nghiem", rot=90), F({}, "nghiem", rot=70), F({}, "nghiem", rot=40),
            F(kneel_pose(KNEEL2_LEGS, None, 20), "nghiem"), F(kneel_pose(KNEEL_LEGS, None, 12), "nghiem"),
            F(kneel_pose(KNEEL_LEGS, None, 4), "nghiem"),
            F({"legs": mix_limbs(KNEEL_LEGS, DEF_LEGS, 0.5), "LIFT": ground(mix_limbs(KNEEL_LEGS, DEF_LEGS, 0.5))}, "nghiem"),
            F({"DY": 4}, "nghiem"), F({}, "nghiem")]

SALUTE = {1: ((98, 420), (18, 394)), -1: ((-98, 420), (-18, 394))}
def anim_salute():
    seq = [0, 0.4, 0.8, 1, 1, 1, 0.6, 0.2]
    bow = [0, 0, 0, 6, 12, 12, 6, 0]
    return [F({"arms": mix_limbs(DEF_ARMS, SALUTE, u), "DY": b}, "nham_mat" if b >= 12 else "nghiem") for u, b in zip(seq, bow)]

def anim_wave():
    n = 8; fr = []
    for i in range(n):
        w = math.sin(2 * PI * i / 4)
        fr.append(F({"arms": {1: ((112, 250), (130 + 18 * w, 160))}, "DY": breathe(i, n, 3)}, "cuoi"))
    return fr

GUARD_LEGS = {1: ((54, 770), (66, 935)), -1: ((-54, 770), (-66, 935))}
def anim_attack_front(w):
    G = {"legs": GUARD_LEGS, "DY": 12}
    A = lambda arms, ang, **kw: {**G, **kw, "arms": arms, "weapon": dict(side=-1, angle=ang, length=230)}
    ready = {-1: ((-104, 430), (-70, 500)), 1: ((100, 420), (64, 470))}
    return [F(A(ready, -118), "lanh_lung"),
            F(A({**ready, -1: ((-100, 300), (-86, 220))}, -80, DX=-4), "gian"),
            F(A({**ready, -1: ((-100, 250), (-80, 170))}, -55, DX=-6), "gian"),
            F(A({**ready, -1: ((-60, 300), (-10, 330))}, -15, DX=0), "gian"),
            F(A({**ready, -1: ((-40, 340), (30, 380))}, 8, DX=4), "gian"),
            F(A({**ready, -1: ((20, 430), (80, 520))}, 58, DX=10, DY=16), "gian"),
            F(A({**ready, -1: ((10, 430), (60, 510))}, 40, DX=6, DY=14), "lanh_lung"),
            F(A(ready, -100, DX=2), "lanh_lung")]

def anim_attack_side():
    S = {"view": "side"}
    lunge = {1: ((80, 740), (110, 935)), -1: ((-60, 760), (-110, 935))}
    stand = {1: ((20, 770), (24, 935)), -1: ((-20, 770), (-24, 935))}
    def P(legs, arm_near, ang, dx=0):
        arms = {1: arm_near, -1: ((-30, 440), (-10, 520))}
        return {**S, "legs": legs, "LIFT": ground(legs), "arms": arms, "DX": dx, "weapon": dict(side=1, angle=ang, length=230)}
    return [F(P(stand, ((30, 440), (70, 470)), -40), "lanh_lung"),
            F(P(stand, ((-10, 300), (-20, 200)), -120, -4), "gian"),
            F(P(mix_limbs(stand, lunge, 0.5), ((-6, 260), (10, 160)), -100, -2), "gian"),
            F(P(lunge, ((60, 300), (130, 280)), -20, 8), "gian"),
            F(P(lunge, ((70, 360), (140, 400)), 25, 12), "gian"),
            F(P(lunge, ((60, 400), (110, 480)), 60, 12), "gian"),
            F(P(mix_limbs(lunge, stand, 0.5), ((40, 430), (80, 480)), 20, 6), "lanh_lung"),
            F(P(stand, ((30, 440), (70, 470)), -40), "lanh_lung")]

def anim_hurt():
    ar = lambda y: {1: ((104, 400), (122, y)), -1: ((-104, 400), (-122, y))}
    return [F({"DX": -10, "DY": -4, "arms": ar(350)}, "dau"), F({"DX": -16, "DY": 2, "arms": ar(380)}, "dau"),
            F({"DX": -18, "DY": 6, "arms": ar(420)}, "dau"), F({"DX": -12, "DY": 4, "arms": ar(470)}, "dau"),
            F({"DX": -6, "DY": 2}, "nghiem"), F({}, "nghiem")]

def anim_victory():
    n = 8; fr = []
    lifts = [0, 6, 14, 20, 14, 6, 0, 0]
    for i in range(n):
        fr.append(F({"arms": {1: ((104, 230), (112, 140 - lifts[i]))}, "LIFT": lifts[i], "DY": 6 if i in (0, 6) else 0,
                     "weapon": dict(side=-1, angle=112, length=240)}, "cuoi"))
    return fr

def anim_jump():
    crouch = {1: ((56, 760), (46, 935)), -1: ((-56, 760), (-46, 935))}
    up = {1: ((44, 740), (40, 890)), -1: ((-44, 740), (-40, 890))}
    armsU = {1: ((110, 300), (120, 220)), -1: ((-110, 300), (-120, 220))}
    seq = [({}, 0, 0, None), (crouch, 0, 12, None), (crouch, 0, 16, None), ({}, 20, -4, armsU), (up, 48, -6, armsU),
           (up, 64, -6, armsU), (up, 56, -4, armsU), ({}, 30, 0, None), (crouch, 0, 14, None), ({}, 0, 4, None)]
    out_ = []
    for legs, lift, dy, arms in seq:
        p = {"legs": legs, "DY": dy, "LIFT": (ground(legs) if legs and lift == 0 else 0) + lift}
        if arms: p["arms"] = arms
        out_.append(F(p, "lanh_lung" if lift else "nghiem"))
    return out_

def flip(frames): return [(p, e, {**meta, "flip": True}) for p, e, meta in frames]

ANIMS = [  # id, Vietnamese name, direction, fps, loop, frames, combat(weapon in hand)
    ("cho_xuong", "Đứng chờ – hướng xuống", "xuống", 6, True, lambda: anim_idle("front"), False),
    ("cho_len", "Đứng chờ – hướng lên", "lên", 6, True, lambda: anim_idle("back"), False),
    ("cho_phai", "Đứng chờ – hướng phải", "phải", 6, True, lambda: anim_idle("side"), False),
    ("cho_trai", "Đứng chờ – hướng trái", "trái", 6, True, lambda: flip(anim_idle("side")), False),
    ("di_xuong", "Đi – hướng xuống", "xuống", 10, True, lambda: anim_walk("front"), False),
    ("di_len", "Đi – hướng lên", "lên", 10, True, lambda: anim_walk("back"), False),
    ("di_phai", "Đi – hướng phải", "phải", 10, True, lambda: anim_walk("side"), False),
    ("di_trai", "Đi – hướng trái", "trái", 10, True, lambda: flip(anim_walk("side")), False),
    ("chay_xuong", "Chạy – hướng xuống", "xuống", 14, True, lambda: anim_run("front"), False),
    ("chay_len", "Chạy – hướng lên", "lên", 14, True, lambda: anim_run("back"), False),
    ("chay_phai", "Chạy – hướng phải", "phải", 14, True, lambda: anim_run("side"), False),
    ("chay_trai", "Chạy – hướng trái", "trái", 14, True, lambda: flip(anim_run("side")), False),
    ("cho_cu_dong", "Đứng chờ có cử động nhỏ", "xuống", 8, True, anim_fidget, False),
    ("nhin_quanh", "Nhìn quanh", "xuống", 8, True, anim_look, False),
    ("noi_chuyen", "Nói chuyện – hướng xuống", "xuống", 8, True, lambda: anim_talk("front"), False),
    ("noi_chuyen_phai", "Nói chuyện – hướng phải", "phải", 8, True, lambda: anim_talk("side"), False),
    ("noi_chuyen_trai", "Nói chuyện – hướng trái", "trái", 8, True, lambda: flip(anim_talk("side")), False),
    ("dung_nghiem", "Đứng nghiêm, không cười", "xuống", 6, True, anim_stern, False),
    ("cuoi_vui", "Cười vui", "xuống", 10, True, anim_laugh, False),
    ("ngoi_xuong", "Ngồi xuống", "xuống", 8, False, anim_sit_down, False),
    ("ngoi_cho", "Ngồi chờ", "xuống", 6, True, anim_sit_idle, False),
    ("ngoi_thien", "Ngồi thiền", "xuống", 5, True, anim_meditate, False),
    ("dung_day", "Đứng dậy", "xuống", 8, False, anim_stand_up, False),
    ("nam_ngu", "Nằm ngủ", "nằm", 4, True, anim_sleep, False),
    ("nga_xuong", "Ngã xuống", "xuống", 10, False, anim_fall, False),
    ("tinh_day", "Tỉnh dậy, đứng lên", "xuống", 8, False, anim_get_up, False),
    ("quy_goi", "Quỳ một gối", "xuống", 6, True, anim_kneel, False),
    ("om_quyen", "Ôm quyền chào", "xuống", 8, False, anim_salute, False),
    ("vay_tay", "Vẫy tay", "xuống", 10, True, anim_wave, False),
    ("chem_xuong", "Chém kiếm – hướng xuống", "xuống", 12, False, lambda: anim_attack_front(None), True),
    ("chem_phai", "Chém kiếm – hướng phải", "phải", 12, False, anim_attack_side, True),
    ("chem_trai", "Chém kiếm – hướng trái", "trái", 12, False, lambda: flip(anim_attack_side()), True),
    ("trung_don", "Trúng đòn", "xuống", 10, False, anim_hurt, False),
    ("chien_thang", "Chiến thắng", "xuống", 10, False, anim_victory, True),
    ("nhay", "Nhảy", "xuống", 12, False, anim_jump, False),
]
assert len(ANIMS) == 35

# ---------------------------------------------------------------- rendering
def part_list(C, expr, view, combat):
    g = C["gender"]
    _, sets = specs()
    bases = [f"body_{C['skin']}", f"arms_{C['skin']}", f"hands_{C['skin']}"]
    if view != "back": bases.append(f"face_{expr}_{C['eyes']}")
    bases.append(f"hair_{C['hair']}_{C['color']}_back")
    if view != "back": bases.append(f"hair_{C['hair']}_{C['color']}_front")
    for slot, base in sets[C["outfit"]]["parts"].items():
        if slot == "weapon": continue
        bases.append(base)
    if combat: bases.append(C["weapon"])
    return [resolve(b, g) for b in bases if resolve(b, g)]

def layer_key(spec, view):
    slot, order = spec[3], spec[6]
    layer, dorder, _ = B.SLOTS[slot]
    o = dorder if order is None else order
    li = B.SORT[layer]
    if view == "back":
        if slot == "hair_back": li, o = 3, -1
        if slot == "back": li, o = 2, 40
    return (li, o)

def render_char(C, pose, expr, combat):
    set_pose(pose); view = pose.get("view", "front")
    m.set_gender(C["gender"])
    layers = []
    for spec in part_list(C, expr, view, combat):
        img, sleeve = B.render_spec(spec, "x")
        if view == "side" and spec[3] in ("hair_back", "hair_front"):
            img = ImageChops.offset(img, -3 if spec[3] == "hair_back" else 1, 0)
        key = layer_key(spec, view)
        layers.append((key, img))
        if sleeve is not None:
            sk = B.SLOTS[B.SPLIT[spec[3]]]; layers.append(((B.SORT[sk[0]], sk[1]), sleeve))
    layers.sort(key=lambda t: t[0])
    c = Image.new("RGBA", layers[0][1].size, (0, 0, 0, 0))
    for _, img in layers: c.alpha_composite(img)
    m.set_gender("nu")
    return c

def place(char, meta):
    fr = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    rot = meta.get("rot", 0)
    char = char.copy()
    char.paste((0, 0, 0, 0), (0, GROUND_ART, char.width, 256))
    if rot:
        r = char.rotate(rot, resample=Image.NEAREST, expand=True)
        bb = r.getbbox() or (0, 0, r.width, r.height)
        r = r.crop(bb)
        fr.alpha_composite(r, ((FW - r.width) // 2, GROUND_ART - 2 - r.height))
    else:
        fr.alpha_composite(char, ((FW - char.width) // 2, 0))
    if meta.get("flip"): fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
    return fr

def widen():
    """render on a 256-px-wide canvas so swords and lying poses are not clipped"""
    m.W = 1024; m.CXo = 512

def main(od, char_id):
    widen()
    C = CHARS[char_id]
    outdir = os.path.join(od, char_id); os.makedirs(outdir, exist_ok=True)
    meta_all = []
    for aid, name, direction, fps, loop, fn, combat in ANIMS:
        frames = [place(render_char(C, p, e, combat), mt) for p, e, mt in fn()]
        n = len(frames)
        alpha = Image.new("RGBA", (FW * n, FH), (0, 0, 0, 0))
        for i, f in enumerate(frames): alpha.paste(f, (i * FW, 0))
        green = Image.new("RGBA", alpha.size, GREEN); green.alpha_composite(alpha)
        alpha.save(os.path.join(outdir, f"{aid}_alpha.png"), optimize=True)
        green.convert("RGB").save(os.path.join(outdir, f"{aid}.png"), optimize=True)
        gif = []
        for f in frames:
            g = Image.new("RGBA", (FW, FH), GREEN); g.alpha_composite(f)
            gif.append(g.convert("RGB").resize((FW * 2, FH * 2), Image.NEAREST))
        gif[0].save(os.path.join(outdir, f"{aid}.gif"), save_all=True, append_images=gif[1:], duration=int(1000 / fps), loop=0)
        meta_all.append({"id": aid, "name_vi": name, "direction": direction, "frames": n, "fps": fps, "loop": loop,
                         "sheet": f"{aid}.png", "sheet_alpha": f"{aid}_alpha.png", "gif": f"{aid}.gif"})
        print(char_id, aid, n, flush=True)
    atlas = {"format": "pixel-anim-strips.v1", "character": {"id": char_id, "name_vi": C["name"]},
             "frame": {"w": FW, "h": FH}, "pivot": {"x": 0.5, "y": round(1 - (m.GROUND / 4) / FH, 4)},
             "pixelsPerUnit": 64, "background": "#00FF00 (chroma) in <id>.png; transparent in <id>_alpha.png",
             "layout": "each animation is one horizontal strip, frames left to right", "animations": meta_all}
    json.dump(atlas, open(os.path.join(outdir, "animations.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    import modular  # noqa: keep a single module instance
    main(sys.argv[1], sys.argv[2])
