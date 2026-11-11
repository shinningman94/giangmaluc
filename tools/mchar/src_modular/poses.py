"""Standing poses and animation frames (front view). 32 frames = one 8x4 sheet per part.

Coordinates are design units (same space as modular.py). Arms/legs give absolute (elbow, wrist) /
(knee, ankle) per side: +1 = image right (character's left), -1 = image left (character's right, sword hand).
DX/DY/LIFT are output pixels (4 px = 1 art pixel): DX/DY move the upper body (lean, breathe, crouch),
LIFT raises the whole character (hop).
"""
import math

GUARD_LEGS = {1: ((54, 770), (66, 935)), -1: ((-54, 770), (-66, 935))}
WIDE_LEGS = {1: ((48, 770), (56, 935)), -1: ((-48, 770), (-56, 935))}

STAND = {}
GUARD = dict(DY=12, legs=GUARD_LEGS, arms={-1: ((-104, 430), (-70, 500)), 1: ((100, 420), (64, 470))},
             weapon=dict(side=-1, angle=-118, length=230))
LEAN_SWORD = dict(arms={1: ((88, 450), (20, 556)), -1: ((-88, 450), (-20, 556))}, legs=WIDE_LEGS,
                  weapon=dict(both=True, angle=90, length=300))
WAVE = dict(arms={1: ((104, 240), (110, 150))}, weapon=dict(side=-1, angle=112, length=240))
HIPS = dict(arms={1: ((126, 420), (72, 482)), -1: ((-126, 420), (-72, 482))}, legs=WIDE_LEGS,
            weapon=dict(side=-1, angle=100, length=230))
SALUTE = dict(arms={1: ((98, 420), (18, 394)), -1: ((-98, 420), (-18, 394))}, weapon=dict(side=-1, angle=-92, length=220))

def P(base, **kw):
    d = {k: v for k, v in base.items()}
    for k, v in kw.items():
        if k in ("arms", "legs") and k in d: d[k] = {**d[k], **v}
        else: d[k] = v
    return d

def walk(phase):
    """phase 0..5; front-view walk: the lifted knee rises, body bobs, arms swing opposite."""
    lift = [0, 1, 1.6, 0, 1, 1.6][phase]; side = 1 if phase in (1, 2) else -1
    legs = {}
    if lift:
        legs[side] = ((side * 38, 770 - 18 * lift), (side * 36, 935 - 30 * lift))
    sw = [0, 1, 1.6, 0, 1, 1.6][phase] * (1 if side == 1 else -1)
    arms = {1: ((98, 462 + 6 * sw), (114 + 2 * sw, 588 + 8 * sw)), -1: ((-98, 462 - 6 * sw), (-114 + 2 * sw, 588 - 8 * sw))}
    return dict(DY=-4 * lift, legs=legs, arms=arms, weapon=dict(side=-1, angle=112 + 4 * sw, length=240))

FRAMES = [
    # 0-5 standing poses
    ("dung_thang", "pose", STAND, None),
    ("thu_the", "pose", GUARD, "lanh_lung"),
    ("chong_kiem", "pose", LEAN_SWORD, None),
    ("gio_tay", "pose", WAVE, "cuoi"),
    ("chong_nanh", "pose", HIPS, "tu_tin"),
    ("om_quyen", "pose", SALUTE, None),
    # 6-9 idle (breathing)
    ("tho_0", "idle", P(STAND, DY=0), None), ("tho_1", "idle", P(STAND, DY=4), None),
    ("tho_2", "idle", P(STAND, DY=8), None), ("tho_3", "idle", P(STAND, DY=4), None),
    # 10-15 walk
    *[(f"di_{i}", "walk", walk(i), None) for i in range(6)],
    # 16-21 sword attack
    ("chem_0", "attack", GUARD, "lanh_lung"),
    ("chem_1", "attack", P(GUARD, DX=-6, arms={-1: ((-100, 250), (-80, 170))}, weapon=dict(side=-1, angle=-55, length=230)), "gian"),
    ("chem_2", "attack", P(GUARD, DX=4, arms={-1: ((-40, 340), (30, 380))}, weapon=dict(side=-1, angle=8, length=230)), "gian"),
    ("chem_3", "attack", P(GUARD, DX=10, DY=16, arms={-1: ((20, 430), (80, 520))}, weapon=dict(side=-1, angle=58, length=230)), "gian"),
    ("chem_4", "attack", P(GUARD, DX=8, DY=14, arms={-1: ((20, 430), (80, 520))}, weapon=dict(side=-1, angle=62, length=230)), "lanh_lung"),
    ("chem_5", "attack", P(GUARD, DX=2), "lanh_lung"),
    # 22-25 cast / channel qi
    ("van_cong_0", "cast", SALUTE, "nham_mat"),
    ("van_cong_1", "cast", P(SALUTE, DY=4), "nham_mat"),
    ("van_cong_2", "cast", dict(DY=-4, arms={1: ((124, 282), (150, 212)), -1: ((-124, 282), (-150, 212))}, legs=WIDE_LEGS,
                               weapon=dict(side=-1, angle=-100, length=220)), "gian"),
    ("van_cong_3", "cast", dict(DY=-8, arms={1: ((124, 276), (152, 204)), -1: ((-124, 276), (-152, 204))}, legs=WIDE_LEGS,
                               weapon=dict(side=-1, angle=-100, length=220)), "gian"),
    # 26-28 hurt
    ("trung_don_0", "hurt", dict(DX=-12, DY=-4, arms={1: ((104, 400), (122, 350)), -1: ((-104, 400), (-122, 350))},
                                 weapon=dict(side=-1, angle=150, length=230)), "dau"),
    ("trung_don_1", "hurt", dict(DX=-18, DY=4, arms={1: ((104, 410), (124, 420)), -1: ((-104, 410), (-124, 420))},
                                 weapon=dict(side=-1, angle=140, length=230)), "dau"),
    ("trung_don_2", "hurt", dict(DX=-6), "dau"),
    # 29-31 victory
    ("thang_0", "victory", WAVE, "cuoi"),
    ("thang_1", "victory", P(WAVE, LIFT=14, arms={1: ((104, 230), (112, 130))}), "cuoi"),
    ("thang_2", "victory", P(WAVE, DY=6), "cuoi"),
]
assert len(FRAMES) == 32

POSE_NAMES = {"dung_thang": "Đứng thẳng", "thu_the": "Thủ thế", "chong_kiem": "Chống kiếm", "gio_tay": "Giơ tay",
              "chong_nanh": "Chống nạnh", "om_quyen": "Ôm quyền"}
ANIMS = [("idle", "Thở (đứng yên)", 6, True), ("walk", "Đi", 8, True), ("attack", "Chém kiếm", 10, False),
         ("cast", "Vận công", 6, False), ("hurt", "Trúng đòn", 8, False), ("victory", "Chiến thắng", 6, False)]

def set_pose(pose):
    import modular as m
    m.POSE.update({"DX": 0.0, "DY": 0.0, "LIFT": 0.0, "arms": {}, "legs": {}, "weapon": None})
    m.POSE.update({k: v for k, v in pose.items()})
