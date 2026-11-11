"""Modular 2D character parts: base body, face, hair (front/back), outfit pieces.
Every PNG shares one 512x1024 canvas and one anchor (feet centre), so layers stack with no offsets.

python3 modular.py <out_dir>
"""
import math, os, json, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

W, H = 512, 1024            # output canvas (design coordinates use the same space)
PIX = 4                     # one art pixel = 4 output pixels  -> 128x256 pixel-art grid
S = 1 / PIX
CXo = W / 2
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SHADE_MULT = 1.4

# chibi proportions: the head is drawn 1.45x around the chin, the body is squashed toward the ground
CHIN, GROUND = 251, 975
HEAD_S, BODY_SX, BODY_SY = 1.45, 1.12, 0.8
CHIN_OUT = GROUND - (GROUND - CHIN) * BODY_SY
MODE = ["body"]

class space:
    def __init__(self, m): self.m = m
    def __enter__(self): MODE.append(self.m)
    def __exit__(self, *a): MODE.pop()

POSE = {"DX": 0.0, "DY": 0.0, "LIFT": 0.0, "arms": {}, "legs": {}, "weapon": None, "view": "front", "eye_dx": 0.0}
FACE_DX = [0.0]
SIDE_SQ = 0.62
def VIEW(): return POSE.get("view", "front")
def SQ(): return {"side": SIDE_SQ, "q": 0.82, "bq": 0.82}.get(VIEW(), 1.0)

def w_upper(y):
    """how much of the upper-body offset a body point gets: 1 above the waist, 0 from the hips down"""
    if y <= 520: return 1.0
    if y >= 600: return 0.0
    return (600 - y) / 80

def Yb(y): return GROUND - (GROUND - y) * BODY_SY
def Yh(y): return CHIN_OUT + (y - CHIN) * HEAD_S
def map_y(y):
    m = MODE[-1]
    if m == "head" or (m == "hair" and y <= CHIN): return Yh(y) + POSE["DY"] - POSE["LIFT"]
    return Yb(y) + POSE["DY"] * w_upper(y) - POSE["LIFT"]
def map_dx(y):
    m = MODE[-1]
    if m == "head": return POSE["DX"] + FACE_DX[0]
    if m == "hair" and y <= CHIN: return POSE["DX"]
    return POSE["DX"] * w_upper(y)
def sx_at(y):
    m = MODE[-1]
    if m == "head": return HEAD_S
    if m == "hair":
        if y <= CHIN: return HEAD_S
        u = min(1, (y - CHIN) / 110); return (HEAD_S + (1.15 - HEAD_S) * u) * (1 - (1 - SQ()) * u)
    return BODY_SX * SQ()

def X(x, y=None):
    yy = CHIN if y is None and MODE[-1] == "hair" else (y if y is not None else 600)
    return (CXo + x * sx_at(yy) + map_dx(yy)) * S
def Y(y): return map_y(y) * S
def pt(x, y): return (X(x, y), Y(y))
def blank(): return Image.new('L', (int(W * S), int(H * S)), 0)
def rgba_blank(): return Image.new('RGBA', (int(W * S), int(H * S)), (0, 0, 0, 0))

def bbox(cx, cy, rx, ry):
    sx = sx_at(cy); dx = map_dx(cy)
    return [(CXo + (cx - rx) * sx + dx) * S, Y(cy - ry), (CXo + (cx + rx) * sx + dx) * S, Y(cy + ry)]

def ell(cx, cy, rx, ry, m=None):
    m = m or blank(); ImageDraw.Draw(m).ellipse(bbox(cx, cy, rx, ry), fill=255); return m
def poly(pts, m=None):
    m = m or blank(); ImageDraw.Draw(m).polygon([pt(*p) for p in pts], fill=255); return m
def rect(x0, y0, x1, y1):
    m = blank(); ax, bx = sorted((X(x0, y0), X(x1, y1))); ay, by = sorted((Y(y0), Y(y1)))
    ImageDraw.Draw(m).rectangle([ax, ay, bx, by], fill=255); return m
def U(*ms):
    r = ms[0].copy()
    for m in ms[1:]: r = ImageChops.lighter(r, m)
    return r
def I(a, b): return ImageChops.darker(a, b)
def M(a, b): return ImageChops.subtract(a, b)
def yclip(m, y0, y1):
    c = blank(); ImageDraw.Draw(c).rectangle([0, Y(y0), W, Y(y1)], fill=255); return I(m, c)
def dilate4(m):
    return U(m, ImageChops.offset(m, 1, 0), ImageChops.offset(m, -1, 0), ImageChops.offset(m, 0, 1), ImageChops.offset(m, 0, -1))
def grow(m, r):
    if r <= 0: return m
    k = max(1, round(r * S))
    if k == 1: return dilate4(m)
    return m.filter(ImageFilter.MaxFilter(2 * k + 1))
def shift(m, dx, dy):
    sx_ = int(math.copysign(max(1, round(abs(dx) * S * SHADE_MULT)), dx)) if dx else 0
    sy_ = int(math.copysign(max(1, round(abs(dy) * S * SHADE_MULT)), dy)) if dy else 0
    return ImageChops.offset(m, sx_, sy_)
def mirror_pts(pts): return [(-x, y) for x, y in pts]

def smooth(pts, n=8):
    out = []; P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1]); return out

def sym(right, n=8):
    r = smooth(right, n); return r + mirror_pts(list(reversed(r)))

def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def dk(c, f): return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (c[3],)
def mix(a, b, u): return tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3)) + (a[3],)
WHITE = (255, 255, 255, 255)

def paint(img, mask, col, alpha=1.0):
    if alpha < 1: mask = mask.point(lambda v: int(v * alpha))
    img.paste(col, (0, 0) + img.size, mask)

def lines(pts_list, w, clip=None):
    m = blank(); d = ImageDraw.Draw(m)
    for pts in pts_list:
        d.line([pt(*p) for p in pts], fill=255, width=max(1, int(round(w * S))))
    return I(m, clip) if clip is not None else m

def seam(front, back, y0=-9999, y1=9999, w=1.3):
    return yclip(I(M(grow(front, w), front), back), y0, y1)

def render(mask, fill, line=None, lw=2.0, shade=0.8, sd=(9, 6), seams=(), img=None):
    fill = hexc(fill) if isinstance(fill, str) else fill
    line = line or mix(dk(fill, 0.3), (28, 16, 30, 255), 0.35)
    img = img or rgba_blank()
    paint(img, grow(mask, lw), line)
    paint(img, mask, fill)
    if shade:
        paint(img, M(mask, shift(mask, -sd[0], -sd[1])), dk(fill, shade))
    for sm in seams: paint(img, sm, line)
    return img, line

def out(img): return img                      # native pixel-art size (128x256); upscale only for previews
def up(img): return img.resize((W, H), Image.NEAREST)

# ---------------------------------------------------------------- body geometry (output px, x relative to centre)
HEAD = (0, 170, 60, 72)
GEOM = {
    "nu": dict(TORSO_R=[(13, 284), (40, 297), (66, 307), (76, 322), (74, 350), (70, 372), (61, 420), (53, 458), (58, 488),
                        (70, 520), (77, 548), (71, 576), (46, 594), (0, 600)],
               ARM=[(70, 318, 18), (96, 465, 13), (112, 592, 10)], LEG=[(36, 560, 38), (40, 770, 23), (43, 935, 13)],
               FOOT=(47, 960, 19, 14), HAND=(117, 630, 13, 31)),
    "nam": dict(TORSO_R=[(15, 284), (46, 296), (74, 306), (86, 322), (83, 352), (75, 392), (66, 432), (60, 458), (62, 488),
                         (68, 520), (72, 548), (68, 576), (44, 594), (0, 600)],
                ARM=[(77, 318, 21), (102, 465, 15), (118, 592, 12)], LEG=[(36, 560, 38), (39, 770, 25), (42, 935, 15)],
                FOOT=(49, 960, 21, 15), HAND=(123, 630, 15, 33)),
}
GENDERS = {"nam": "Nam", "nu": "Nữ"}
GENDER = ["nu"]

def set_gender(g):
    GENDER[0] = g
    globals().update(GEOM[g])

set_gender("nu")

def head_mask(pad=0):
    cx, cy, rx, ry = HEAD
    m_ = U(ell(cx, cy, rx + pad, ry + pad), poly(smooth([(-56 - pad, 185), (-48 - pad, 222), (-20, 246 + pad), (0, 251 + pad),
                                                              (20, 246 + pad), (48 + pad, 222), (56 + pad, 185)], 6)))
    if VIEW() == "side": m_ = U(m_, poly([(52, 190), (66, 210), (54, 220)]), ell(14, 226, 40, 24))
    return m_

def torso_mask(pad=0):
    pts = []
    for x, y in TORSO_R:
        pts.append((x + pad if x > 0 else x, y - pad if y < 300 else (y + pad if y > 585 else y)))
    return poly(sym(pts))

def arm_chain(s):
    o = POSE["arms"].get(s)
    if VIEW() == "side":
        sh = (s * 6, ARM[0][1], ARM[0][2])
        el, wr = o if o else ((s * 6 + 8, ARM[1][1]), (s * 6 + 14, ARM[2][1]))
        c = [sh, (el[0], el[1], ARM[1][2]), (wr[0], wr[1], ARM[2][2])]
        return [(x / SIDE_SQ, y, r) for x, y, r in c]
    sh = (s * ARM[0][0], ARM[0][1], ARM[0][2])
    if o: return [sh, (o[0][0], o[0][1], ARM[1][2]), (o[1][0], o[1][1], ARM[2][2])]
    return [sh, (s * ARM[1][0], ARM[1][1], ARM[1][2]), (s * ARM[2][0], ARM[2][1], ARM[2][2])]

def leg_chain(s):
    o = POSE["legs"].get(s)
    if VIEW() == "side":
        hip = (s * 8, LEG[0][1], LEG[0][2])
        kn, an = o if o else ((s * 8, LEG[1][1]), (s * 8, LEG[2][1]))
        c = [hip, (kn[0], kn[1], LEG[1][2]), (an[0], an[1], LEG[2][2])]
        return [(x / SIDE_SQ, y, r) for x, y, r in c]
    hip = (s * LEG[0][0], LEG[0][1], LEG[0][2])
    if o: return [hip, (o[0][0], o[0][1], LEG[1][2]), (o[1][0], o[1][1], LEG[2][2])]
    return [hip, (s * LEG[1][0], LEG[1][1], LEG[1][2]), (s * LEG[2][0], LEG[2][1], LEG[2][2])]

def chain_at(chain, split, t):
    if t <= split: a, b, u = chain[0], chain[1], t / split
    else: a, b, u = chain[1], chain[2], (t - split) / (1 - split)
    return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u

def limb(chains, split, t0, t1, pad=0):
    m = blank(); d = ImageDraw.Draw(m)
    steps = int(abs(t1 - t0) * 400) + 2
    for chain in chains:
        for i in range(steps + 1):
            t = t0 + (t1 - t0) * i / steps
            x, y, r = chain_at(chain, split, t)
            r += pad(t) if callable(pad) else pad
            d.ellipse(bbox(x, y, r / SQ(), r), fill=255)
    return m

SLEEVE_REC = []          # while recording, every sleeve-like arms() mask is collected here
ARMS_OFF = [False]

def arms(t0=0, t1=1, pad=0):
    if ARMS_OFF[0]: return blank()
    m = limb([arm_chain(1), arm_chain(-1)], 0.5, t0, t1, pad)
    pv = pad(0.5) if callable(pad) else pad
    if SLEEVE_REC and pv >= 3: SLEEVE_REC[-1].append(m)
    return m

def legs(t0=0, t1=1, pad=0): return limb([leg_chain(1), leg_chain(-1)], 0.56, t0, t1, pad)

def hand_dir(s):
    c = arm_chain(s); (ex, ey, _), (wx, wy, _) = c[1], c[2]
    L = math.hypot(wx - ex, wy - ey) or 1
    return wx, wy, (wx - ex) / L, (wy - ey) / L

def hand_center(s):
    wx, wy, dx, dy = hand_dir(s); return wx + dx * 26, wy + dy * 26

def hands(pad=0, sides=(1, -1)):
    m = blank()
    for s_ in sides:
        wx, wy, dx, dy = hand_dir(s_)
        q = SQ()
        m = U(m, ell(wx + dx * 14, wy + dy * 14, (HAND[2] + pad) / q, HAND[2] + pad),
              ell(wx + dx * 30, wy + dy * 30, (HAND[2] * 0.85 + pad) / q, HAND[2] * 0.85 + pad))
    return m

def feet(pad=0):
    m = blank()
    for s_ in (1, -1):
        ax, ay, _ = leg_chain(s_)[2]
        if VIEW() == "side": ell(ax + 16 / SIDE_SQ, ay + 24, (FOOT[2] + pad + 4) / SIDE_SQ, FOOT[3] + pad - 1, m)
        else: ell(ax + s_ * 5, ay + 25, FOOT[2] + pad, FOOT[3] + pad, m)
    return m

def neck(): return poly([(-13, 225), (13, 225), (15, 292), (-15, 292)])
def ears():
    if VIEW() == "side": return ell(-18, 196, 7, 11)
    if VIEW() == "q": return ell(-56, 192, 8, 15)
    if VIEW() == "bq": return ell(56, 192, 8, 15)
    return U(ell(58, 192, 8, 15), ell(-58, 192, 8, 15))

def leg_at(t, s=1):
    x, y, _ = chain_at(leg_chain(s), 0.56, t); return (x, y) if s < 0 else (abs(x), y)
def arm_at(t, s=1):
    x, y, _ = chain_at(arm_chain(s), 0.5, t); return (x, y) if s < 0 else (abs(x), y)

SKINS = {"sang": ("Da sáng", "#f3d2b8"), "ngam": ("Da ngăm", "#d29a72"), "nau": ("Da nâu", "#8d5a3b")}
UNDER = "#c7c4cf"

def body(skin_hex, gender):
    set_gender(gender)
    skin = hexc(skin_hex)
    line = mix(dk(skin, 0.38), (60, 24, 30, 255), 0.4)
    with space("head"):
        h = head_mask(); e = ears()
        earline = lines([[(60, 186), (58, 198)], [(-60, 186), (-58, 198)]], 6)
    a = U(arms(), hands()); t = torso_mask(); n = neck()
    allm = U(h, e, n, t, a, legs(), feet())
    img, _ = render(allm, skin, line=line, shade=0.84, sd=(6, 4),
                    seams=[seam(a, t, 338), seam(h, U(n, t)), seam(h, e)])
    sk = dk(skin, 0.8)
    paint(img, I(M(shift(h, 0, 6), h), U(n, t)), dk(skin, 0.82))          # chin shadow
    if VIEW() == "front": paint(img, earline, sk)
    if VIEW() == "side":
        with space("head"):
            ear = ears(); paint(img, M(grow(ear, 2), ear), line); paint(img, ell(-18, 197, 2.5, 5), sk)
    if VIEW() in ("front", "q"): paint(img, lines([[(0, 470), (0, 476)]], 6), sk)
    # underwear (bra top + shorts), arms kept in front
    bare_arm = grow(arms(0.08, 1), 1.6)
    top = M(yclip(torso_mask(1.5), 330, 398), bare_arm)
    shorts = yclip(U(torso_mask(1.5), legs(0, 0.3, 1.5)), 500, 614)
    if gender == "nam" and VIEW() in ("front", "q"):
        paint(img, lines([[(-40, 350), (-12, 356)], [(40, 350), (12, 356)], [(-10, 420), (10, 420)], [(-10, 446), (10, 446)]], 4), sk)
    for m_ in ((top, shorts) if gender == "nu" else (shorts,)):
        u, _ = render(m_, UNDER, shade=0.82, sd=(6, 4)); img.alpha_composite(u)
    return out(img)

# ---------------------------------------------------------------- face (pixel art, expressions)
EYES = {"nau": ("Mắt hổ phách", "#8a4a12"), "den": ("Mắt đen", "#2a1d1a"), "xanh": ("Mắt xanh", "#2a5f9a"), "do": ("Mắt đỏ", "#9a1f2c")}
EXPRESSIONS = {"nghiem": "Không cười", "noi": "Nói (miệng mở)", "binh_thuong": "Bình thường", "cuoi": "Cười", "tu_tin": "Cười tự tin", "gian": "Giận dữ", "buon": "Buồn",
               "ngac_nhien": "Ngạc nhiên", "nham_mat": "Nhắm mắt (thiền)", "dau": "Bị đau", "lanh_lung": "Lạnh lùng"}
INK = (38, 24, 28, 255); MOUTH = (120, 40, 44, 255); TONGUE = (214, 98, 96, 255); TEETH = (250, 248, 240, 255)

EYE_K = [1.0]      # eye width factor (profile eyes are narrower)
IRIS_DX = [0.0]    # iris offset toward the facing direction (profile)

def _eye_open(img, cx, cy, iris, s, gender, lid=0, small=False, big=False, slant=None):
    """slant=(dy_inner, dy_outer): lid line height relative to cy at the inner / outer corner (angry, sad...)."""
    h = (13 if big else 11) if gender == "nu" else (12 if big else 9)
    k = EYE_K[0]
    box = rect(cx - 10 * k, cy - h, cx + 10 * k, cy + h)
    xi, xo = cx - 11 * k * s, cx + 11 * k * s
    if slant is None: slant = (-h + lid, -h + lid)
    yi, yo = cy + slant[0], cy + slant[1]
    below = poly([(xi, yi), (xo, yo), (xo, cy + 40), (xi, cy + 40)])
    white = I(box, below)
    paint(img, white, (252, 250, 246, 255))
    ir = (5 if small else 8) * (0.8 if k < 1 else 1)
    ic = cx + IRIS_DX[0]
    irm = I(rect(ic - ir, cy - h + 2, ic + ir, cy + h), white)
    paint(img, irm, iris)
    paint(img, I(rect(ic - ir, cy + 4, ic + ir, cy + h), irm), mix(iris, WHITE, 0.35))
    paint(img, I(rect(ic - 3 * k, cy - 2, ic + 3 * k, cy + 6), irm), dk(iris, 0.35))
    if not small: paint(img, I(rect(ic - ir, cy - h + 3, ic - ir + 5, cy - h + 8), white), WHITE)
    paint(img, lines([[(xi - 2 * s, yi), (xo + 2 * s, yo)]], 5 * 2.4 / 2), INK)                  # upper lid
    if gender == "nu":
        paint(img, poly([(xo, yo - 1), (xo + 7 * s, yo - 6), (xo + 4 * s, yo + 4)]), INK)
    paint(img, rect(cx - 8 * k, cy + h, cx + 8 * k, cy + h + 2), mix(INK, (200, 150, 140, 255), 0.5))   # lower lid

def _brow(img, cx, s, inner_dy, outer_dy, gender, base=166):
    t = 4 if gender == "nam" else 3
    k = EYE_K[0]
    paint(img, lines([[(cx - 12 * k * s, base + inner_dy), (cx + 12 * k * s, base + outer_dy)]], t * 2.4), INK)

def _blush(img, a=0.5):
    if VIEW() == "side":
        paint(img, rect(4, 210, 16, 216), (236, 130, 130, 255), a); return
    for s in ((1, -1) if VIEW() in ("front", "q") else (1,)): paint(img, rect(s * 36 - 8, 210, s * 36 + 8, 216), (236, 130, 130, 255), a)

def face(expr, iris_hex, gender):
    img = rgba_blank(); iris = hexc(iris_hex)
    if VIEW() in ("back", "bq"): return img
    try:
        _face(img, expr, iris, gender)
    finally:
        FACE_DX[0] = 0.0; EYE_K[0] = 1.0; IRIS_DX[0] = 0.0
    return out(img)

def _face(img, expr, iris, gender):
    side = VIEW() == "side"
    FACE_DX[0] = (16.0 if side else 7.0 if VIEW() == "q" else 0.0) + POSE.get("eye_dx", 0.0)
    EYE_K[0] = 0.6 if side else 1.0
    IRIS_DX[0] = 3.0 if side else 0.0
    with space("head"):
        for s in ((-1,) if side else (1, -1)):
            cx, cy = (25 if side else 25 * s), 194
            if expr == "cuoi":
                paint(img, lines([[(cx - 11 * EYE_K[0], cy + 4), (cx, cy - 7), (cx + 11 * EYE_K[0], cy + 4)]], 3.2 * 2.4), INK)
                _brow(img, cx, s, -2, -4, gender, 164)
            elif expr == "nham_mat":
                paint(img, lines([[(cx - 11 * EYE_K[0], cy), (cx - 4 * EYE_K[0], cy + 5), (cx + 4 * EYE_K[0], cy + 5), (cx + 11 * EYE_K[0], cy)]], 3 * 2.4), INK)
                if gender == "nu": paint(img, lines([[(cx + 10 * EYE_K[0] * s, cy), (cx + 15 * EYE_K[0] * s, cy - 3)]], 2.4), INK)
                _brow(img, cx, s, 0, 0, gender, 168)
            elif expr == "dau":
                paint(img, lines([[(cx - 9 * EYE_K[0] * s, cy - 8), (cx + 7 * EYE_K[0] * s, cy), (cx - 9 * EYE_K[0] * s, cy + 8)]], 3 * 2.4), INK)
                _brow(img, cx, s, -6, 2, gender, 166)
            elif expr == "gian":
                _eye_open(img, cx, cy, iris, s, gender, slant=(-2, -11))
                _brow(img, cx, s, 9, -5, gender, 166)
            elif expr == "buon":
                _eye_open(img, cx, cy, iris, s, gender, slant=(-11, -3))
                _brow(img, cx, s, -8, 2, gender, 170)
            elif expr == "ngac_nhien":
                _eye_open(img, cx, cy, iris, s, gender, small=True, big=True)
                _brow(img, cx, s, -6, -6, gender, 158)
            elif expr == "lanh_lung":
                _eye_open(img, cx, cy, iris, s, gender, slant=(-3, -3))
                _brow(img, cx, s, 2, 0, gender, 172)
            elif expr == "tu_tin":
                _eye_open(img, cx, cy, iris, s, gender, slant=(-5, -8))
                _brow(img, cx, s, 2, -3, gender, 168)
            else:
                _eye_open(img, cx, cy, iris, s, gender)
                _brow(img, cx, s, 0, -2, gender, 166)
        # mouths
        FACE_DX[0] = 64.0 if side else 16.0 if VIEW() == "q" else POSE.get("eye_dx", 0.0) * 0.3
        EYE_K[0] = 1.0; IRIS_DX[0] = 0.0
        if expr == "nghiem":
            paint(img, lines([[(-6, 231), (6, 231)]], 2.2 * 2.4), MOUTH)
        elif expr == "noi":
            paint(img, ell(0, 231, 6, 5), MOUTH); paint(img, rect(-3, 233, 3, 235), TONGUE)
        elif expr == "cuoi":
            paint(img, poly([(-10, 226), (10, 226), (6, 236), (0, 238), (-6, 236)]), MOUTH)
            paint(img, rect(-5, 233, 5, 237), TONGUE); _blush(img, 0.65)
        elif expr == "tu_tin":
            paint(img, lines([[(-6, 231), (4, 231), (10, 226)]], 2.6 * 2.4), MOUTH); _blush(img, 0.3)
        elif expr == "gian":
            paint(img, poly([(-11, 224), (11, 224), (8, 240), (-8, 240)]), MOUTH)
            paint(img, rect(-9, 224, 9, 228), TEETH); paint(img, rect(-5, 236, 5, 240), TONGUE)
            paint(img, rect(-30, 206, -24, 212), (236, 130, 130, 255), 0.5)
        elif expr == "buon":
            paint(img, lines([[(-7, 234), (0, 230), (7, 234)]], 2.4 * 2.4), MOUTH)
            paint(img, poly([(30, 206), (34, 216), (30, 220), (26, 216)]), (150, 210, 245, 255))
        elif expr == "ngac_nhien":
            paint(img, ell(0, 232, 5, 7), MOUTH); paint(img, ell(0, 234, 3, 3), TONGUE)
        elif expr == "dau":
            paint(img, lines([[(-9, 232), (-4, 228), (0, 232), (4, 228), (9, 232)]], 2.4 * 2.4), MOUTH)
            paint(img, poly([(50, 150), (55, 162), (50, 168), (45, 162)]), (150, 210, 245, 255))
        elif expr == "nham_mat":
            paint(img, lines([[(-5, 231), (5, 231)]], 2.2 * 2.4), MOUTH); _blush(img, 0.35)
        elif expr == "lanh_lung":
            paint(img, lines([[(-6, 232), (6, 232)]], 2.2 * 2.4), MOUTH)
        else:
            paint(img, lines([[(-6, 230), (0, 232), (6, 230)]], 2.2 * 2.4), MOUTH); _blush(img, 0.4)

# ---------------------------------------------------------------- hair
HAIR_COLORS = {"den": ("Đen", "#24212b"), "nau": ("Nâu", "#5a3a26"), "bac": ("Bạc", "#d4d7df"), "lam": ("Lam đen", "#21445c")}

def cap(y=160): return yclip(ell(0, 165, 70, 76), 0, y)

def bangs_spiky(y0=148, tip=182, n=7, x0=-62, x1=62, lean=0):
    pts = [(x0, y0)]
    for i in range(n):
        a = x0 + (x1 - x0) * i / n; b = x0 + (x1 - x0) * (i + 1) / n
        pts += [((a + b) / 2 + lean, tip - (8 if i % 2 else 0)), (b, y0 + 10)]
    pts += [(x1, y0 - 20), (x0, y0 - 20)]
    return poly(pts)

def side_lock(s, y1=232, w=14, xo=58):
    return poly(smooth([(s * (xo - 4), 140), (s * (xo + w), 145), (s * (xo + w - 2), y1 - 20), (s * (xo + 4), y1), (s * (xo - 6), 185)], 5))

def hair_shapes(style):
    if style == "ngan":
        front = U(cap(), bangs_spiky(), side_lock(1, 228), side_lock(-1, 228))
        back = yclip(ell(0, 172, 72, 82), 0, 252)
        name = "Ngắn"
    elif style == "bob":
        bang = poly(smooth([(-64, 140), (64, 140), (62, 172), (40, 176), (20, 170), (0, 177), (-20, 171), (-42, 176), (-62, 172)], 4))
        front = U(cap(), bang, side_lock(1, 262, 18, 56), side_lock(-1, 262, 18, 56))
        back = poly(smooth([(-74, 120), (0, 92), (74, 120), (84, 200), (82, 262), (-82, 262), (-84, 200)], 6))
        name = "Bob"
    elif style == "dai":
        front = U(cap(), bangs_spiky(150, 186, 6, -62, 62, 8),
                  poly(smooth([(52, 140), (72, 148), (82, 260), (86, 360), (74, 372), (66, 280), (54, 200)], 6)),
                  poly(smooth([(-52, 140), (-72, 148), (-82, 260), (-86, 360), (-74, 372), (-66, 280), (-54, 200)], 6)))
        back = U(ell(0, 172, 74, 82), poly(smooth([(-76, 190), (76, 190), (88, 420), (84, 560), (70, 615), (50, 590), (30, 625),
                                                   (0, 600), (-30, 625), (-50, 590), (-70, 615), (-84, 560), (-88, 420)], 6)))
        name = "Dài thẳng"
    elif style == "duoi_ngua":
        front = U(cap(), bangs_spiky(148, 180, 6), side_lock(1, 230, 12), side_lock(-1, 230, 12))
        back = U(yclip(ell(0, 172, 72, 82), 0, 240),
                 poly(smooth([(30, 96), (64, 88), (92, 120), (104, 200), (100, 320), (90, 440), (74, 530), (76, 440), (72, 320),
                              (66, 220), (50, 140)], 6)))
        name = "Đuôi ngựa"
    elif style == "hai_bim":
        front = U(cap(), bangs_spiky(148, 180, 6), side_lock(1, 226, 12), side_lock(-1, 226, 12))
        tails = [poly(smooth([(s * 58, 128), (s * 94, 146), (s * 112, 240), (s * 114, 380), (s * 104, 520), (s * 92, 585),
                              (s * 88, 500), (s * 84, 360), (s * 74, 232), (s * 56, 170)], 6)) for s in (1, -1)]
        back = U(yclip(ell(0, 172, 72, 82), 0, 240), *tails)
        name = "Hai bím"
    elif style == "dung":
        spikes = [poly([(a, 140), (tx, ty), (b, 118)]) for a, b, tx, ty in
                  [(-66, -30, -100, 96), (-56, -10, -84, 46), (-30, 18, -40, 18), (0, 44, 6, 12), (24, 66, 56, 30)]]
        front = U(cap(), *spikes, bangs_spiky(146, 192, 5, -62, 62, -6), side_lock(1, 226), side_lock(-1, 226))
        back = U(yclip(ell(0, 172, 74, 84), 0, 252), poly([(-60, 160), (-104, 170), (-66, 200)]), poly([(60, 160), (104, 170), (66, 200)]),
                 poly([(-62, 200), (-96, 236), (-58, 230)]), poly([(62, 200), (96, 236), (58, 230)]))
        name = "Dựng"
    elif style == "bui":
        front = U(yclip(ell(0, 165, 68, 76), 0, 142), side_lock(1, 220, 8, 56), side_lock(-1, 220, 8, 56))
        back = U(yclip(ell(0, 172, 70, 80), 0, 230), ell(0, 92, 32, 27))
        name = "Búi"
    else:
        import ancient
        return ancient.hair_shapes_ancient(style)
    return name, front, back

HAIR_STYLES = ["kiem_tien", "thieu_nien", "co_trang_nam", "co_trang_nu", "bui", "duoi_ngua", "dai"]

SIDE_HAIRLINE = [(-110, 30), (110, 30), (110, 150), (68, 156), (62, 178), (54, 166), (46, 180), (36, 164), (24, 160), (12, 168),
                 (6, 206), (-4, 210), (-8, 182), (-28, 184), (-32, 232), (-62, 264), (-110, 264)]

def side_hair(style_front):
    head = ell(0, 168, 72, 80)
    cap = I(U(head, ell(-8, 176, 74, 86)), poly(SIDE_HAIRLINE))
    crown = I(M(style_front, grow(ell(0, 165, 70, 76), 4)), rect(-200, 0, 200, 150))
    return U(cap, crown)

def hair(style, col_hex):
  with space("hair"):
    name, front, back = hair_shapes(style)
    if VIEW() == "side": front = side_hair(front)
    col = hexc(col_hex); line = mix(dk(col, 0.35), (30, 20, 30, 255), 0.5)
    fimg, _ = render(front, col, line=line, shade=0.78, sd=(10, 7))
    hl = I(M(ell(-8, 128, 46, 20), ell(-8, 135, 42, 15)), front)
    paint(fimg, hl, mix(col, WHITE, 0.4))
    strands = [[(0, 104), (x, 172)] for x in (-30, 30)]
    paint(fimg, lines(strands, 1.3, I(front, rect(-200, 118, 200, 400))), dk(col, 0.72))
    bimg, _ = render(back, dk(col, 0.88), line=line, shade=0.8, sd=(10, 7))
    if style in ("dai", "duoi_ngua", "hai_bim"):
        paint(bimg, lines([[(x, 260), (x * 1.08, 560)] for x in (-60, -30, 30, 60)] + [[(80, 160), (90, 480)], [(-80, 160), (-90, 480)]],
                          1.3, back), dk(col, 0.7))
    tie = hexc("#c8323c")
    if style == "duoi_ngua": t, _ = render(ell(54, 112, 11, 11), tie, shade=0.75, sd=(4, 3)); bimg.alpha_composite(t)
    if style == "hai_bim":
        for s in (1, -1): t, _ = render(ell(s * 70, 140, 11, 11), tie, shade=0.75, sd=(4, 3)); bimg.alpha_composite(t)
    if style == "bui":
        t, _ = render(yclip(M(ell(0, 108, 30, 14), ell(0, 104, 24, 10)), 100, 130), "#c99a3c", shade=0.8, sd=(4, 3)); bimg.alpha_composite(t)
        pin, _ = render(lines([[(-50, 84), (52, 104)]], 3.5), "#7a3b22", shade=0, lw=1.2); bimg.alpha_composite(pin)
    import ancient
    ancient.hair_extras(style, bimg)
    return name, out(fimg), out(bimg)

# ---------------------------------------------------------------- outfit pieces
def bare(t0): return grow(arms(t0, 1), 1.8)

def piece(mask, fill, **kw):
    img, line = render(mask, fill, **kw); return img, line

def star(cx, cy, r1, r2, n=5, rot=-math.pi / 2):
    return poly([(cx + math.cos(rot + math.pi * i / n) * (r1 if i % 2 == 0 else r2),
                  cy + math.sin(rot + math.pi * i / n) * (r1 if i % 2 == 0 else r2)) for i in range(2 * n)])

def flower(cx, cy, r, m=None):
    m = m or blank()
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        ell(cx + math.cos(a) * r, cy + math.sin(a) * r, r * 0.75, r * 0.75, m)
    return m

# --- tops (slot "top")
def top_tee():
    tor = M(yclip(torso_mask(6), 266, 548), ell(0, 282, 20, 13)); sl = arms(0, 0.32, 7)
    img, line = piece(U(tor, sl), "#d64541", seams=[seam(sl, tor, 336)])
    m = U(tor, sl)
    paint(img, I(M(ell(0, 284, 25, 17), ell(0, 282, 20, 13)), m), dk(hexc("#d64541"), 0.75))
    paint(img, star(0, 382, 24, 10), hexc("#f3e9d2"))
    ax, ay = arm_at(0.29)
    paint(img, lines([[(ax - 22, ay + 4), (ax + 22, ay + 4)], [(-ax + 22, ay + 4), (-ax - 22, ay + 4)],
                      [(-74, 536), (74, 536)]], 1.3, m), line)
    return img

def top_school():
    tor = M(yclip(torso_mask(5), 266, 494), ell(0, 284, 15, 12)); sl = arms(0, 0.3, 6)
    m = U(tor, sl)
    img, line = piece(m, "#f6f6f2", seams=[seam(sl, tor, 336)], shade=0.88)
    for s in (1, -1):
        c, _ = render(poly([(s * 2, 288), (s * 22, 280), (s * 34, 312), (s * 6, 304)]), "#f6f6f2", shade=0.9, sd=(4, 3)); img.alpha_composite(c)
    for y in (330, 370, 410, 450): paint(img, ell(0, y, 2.6, 2.6), dk(hexc("#f6f6f2"), 0.6))
    bow = U(poly([(0, 300), (-26, 286), (-24, 318)]), poly([(0, 300), (26, 286), (24, 318)]),
            poly([(-4, 302), (-14, 340), (-4, 336)]), poly([(4, 302), (14, 340), (4, 336)]))
    b, _ = render(bow, "#c8323c", shade=0.78, sd=(4, 3)); img.alpha_composite(b)
    k, _ = render(ell(0, 301, 6, 6), "#c8323c", shade=0.7, sd=(2, 2)); img.alpha_composite(k)
    paint(img, lines([[(-40, 380), (-30, 430)], [(44, 400), (36, 446)]], 1.1, m), dk(hexc("#f6f6f2"), 0.75))
    return img

def top_aodai():
    col = "#c41e3a"
    tor = yclip(torso_mask(3), 268, 484); sl = arms(0, 0.97, 4.5)
    collar = poly([(-17, 258), (17, 258), (19, 292), (-19, 292)])
    panel = poly(smooth([(-50, 474), (-56, 560), (-62, 700), (-66, 900), (66, 900), (62, 700), (56, 560), (50, 474)], 6))
    m = U(tor, sl, collar, panel)
    img, line = piece(m, col, seams=[seam(sl, tor, 336), seam(collar, tor)], sd=(8, 5))
    gold = hexc("#e6b84a")
    fl = blank()
    for cx, cy, r in [(-30, 380, 6), (34, 420, 5), (-20, 620, 8), (24, 700, 9), (-34, 790, 7), (30, 860, 6), (0, 540, 6)]:
        flower(cx, cy, r, fl);
    paint(img, I(fl, m), gold)
    paint(img, I(U(*[ell(cx, cy, 2.5, 2.5) for cx, cy in [(-30, 380), (34, 420), (-20, 620), (24, 700), (-34, 790), (30, 860), (0, 540)]]), m), dk(hexc(col), 0.6))
    paint(img, lines([[(17, 280), (40, 300), (70, 330)], [(-66, 896), (66, 896)]], 1.4, m), gold)
    for x, y in [(30, 292), (50, 312)]: paint(img, ell(x, y, 2.2, 2.2), gold)
    return img

def top_ninja():
    col = "#2b3350"
    tor = yclip(torso_mask(8), 266, 578); sl = arms(0, 0.48, lambda t: 8 + 12 * t)
    m = U(tor, sl)
    img, line = piece(m, col, seams=[seam(sl, tor, 336)])
    lap = U(poly([(-22, 276), (-10, 276), (36, 472), (22, 472)]), poly([(22, 276), (10, 276), (-6, 340), (-14, 330)]))
    l2, _ = render(I(lap, m), "#d8d0bc", shade=0.85, sd=(3, 3)); img.alpha_composite(l2)
    obi = yclip(torso_mask(10), 456, 500)
    o, _ = render(obi, "#b8302a", sd=(6, 4)); img.alpha_composite(o)
    k, _ = render(U(poly([(30, 470), (58, 520), (44, 530)]), poly([(36, 470), (24, 528), (12, 520)])), "#b8302a", sd=(3, 3)); img.alpha_composite(k)
    return img

def top_gambeson():
    col = "#7b5b3c"
    tor = M(yclip(torso_mask(5), 266, 562), ell(0, 282, 17, 12)); sl = arms(0, 0.95, 5)
    m = U(tor, sl)
    img, line = piece(m, col, seams=[seam(sl, tor, 336)])
    paint(img, lines([[(x, 300), (x * 1.1, 560)] for x in (-48, -24, 0, 24, 48)] +
                     [[(-90, y), (90, y)] for y in (360, 420, 480)], 1.2, m), dk(hexc(col), 0.7))
    return img

def top_tunic():
    col = "#d8cfb8"
    tor = M(yclip(torso_mask(4), 266, 496), ell(0, 282, 17, 12)); sl = arms(0, 0.36, 5)
    img, line = piece(U(tor, sl), col, seams=[seam(sl, tor, 336)])
    return img

# --- outer (slot "outer", same sorting layer as top, higher order)
def outer_hoodie():
    col = "#55657a"
    opening = poly([(-6, 286), (6, 286), (28, 560), (-28, 560)])
    tor = M(yclip(torso_mask(10), 264, 554), opening); sl = arms(0, 0.95, 9)
    hood = yclip(M(ell(0, 288, 48, 22), ell(0, 278, 22, 22)), 260, 302)
    m = U(tor, sl)
    img, line = piece(m, col, seams=[seam(sl, tor, 336)])
    h, _ = render(M(hood, opening), dk(hexc(col), 0.9), sd=(4, 3)); img.alpha_composite(h)
    c = hexc(col)
    paint(img, lines([[(-56, 470), (-10, 470)], [(56, 470), (10, 470)], [(-56, 470), (-60, 540)], [(56, 470), (60, 540)],
                      [(-90, 540), (90, 540)]], 1.4, m), line)
    cuffs = M(arms(0.86, 0.95, 9), arms(0, 0.86, 9))
    paint(img, I(cuffs, m), dk(c, 0.85))
    paint(img, lines([[(-12, 300), (-14, 372)], [(12, 300), (14, 374)]], 2), hexc("#eeeeee"))
    return img

def outer_armor():
    steel = "#aeb6bf"
    img = rgba_blank()
    vb = arms(0.6, 0.93, 7)
    render(vb, steel, img=img, sd=(6, 4))
    plate = yclip(torso_mask(11), 294, 498)
    _, line = render(plate, steel, img=img, sd=(10, 6))
    paint(img, I(ell(-28, 392, 18, 70), plate), mix(hexc(steel), WHITE, 0.45))
    paint(img, lines([[(0, 300), (0, 490)], [(-80, 452), (80, 452)]], 1.4, plate), line)
    tas = poly([(-72, 486), (72, 486), (86, 602), (-86, 602)])
    tm, tl = render(tas, "#8f98a3", sd=(8, 5)); img.alpha_composite(tm)
    paint(img, lines([[(-26, 500), (-30, 600)], [(26, 500), (30, 600)]], 1.4, tas), tl)
    belt = yclip(torso_mask(13), 482, 500)
    render(belt, "#6a4426", img=img, sd=(5, 3))
    render(rect(-10, 480, 10, 502), "#e2b33c", img=img, sd=(3, 2))
    for s in (1, -1):
        pa = U(ell(s * 82, 318, 31, 25), ell(s * 88, 344, 27, 17))
        render(pa, steel, img=img, sd=(7, 5))
        paint(img, lines([[(s * 62, 338), (s * 110, 346)]], 1.4, pa), line)
        for x, y in [(s * 70, 312), (s * 96, 314)]: paint(img, ell(x, y, 2.4, 2.4), dk(hexc(steel), 0.55))
    render(poly([(-24, 270), (24, 270), (32, 300), (-32, 300)]), steel, img=img, sd=(4, 3))
    return img

def outer_robe():
    col = "#4b2c7a"
    bell = lambda t: 9 + 26 * t * t
    sl = arms(0, 0.9, bell)
    tor = M(yclip(torso_mask(9), 262, 470), poly([(-15, 266), (15, 266), (0, 336)]))
    skirt = poly(sym([(60, 456), (72, 540), (84, 660), (100, 800), (116, 932)]))
    m = U(tor, skirt, sl)
    img, line = piece(m, col, seams=[seam(sl, U(tor, skirt), 336)])
    gold = hexc("#e2b33c")
    cuffs = M(sl, arms(0, 0.82, bell))
    paint(img, I(cuffs, m), gold)
    paint(img, yclip(skirt, 914, 940), gold)
    paint(img, lines([[(0, 336), (0, 930)]], 2.4, m), gold)
    rope = yclip(torso_mask(10), 458, 470)
    render(rope, "#e2b33c", img=img, sd=(3, 2), lw=1.4)
    render(U(lines([[(20, 468), (24, 560)], [(28, 468), (36, 548)]], 3)), "#e2b33c", img=img, shade=0, lw=1.2)
    for cx, cy in [(-40, 760), (50, 840), (-70, 880)]: paint(img, I(star(cx, cy, 7, 3, 4), m), gold)
    return img

# --- bottoms (slot "bottom")
def bottom_jeans():
    col = "#3b5b8c"
    m = U(yclip(torso_mask(6), 466, 612), legs(0, 0.94, 6))
    img, line = piece(m, col)
    paint(img, lines([[(-80, 484), (80, 484)], [(0, 486), (0, 570)], [(-60, 500), (-40, 530)], [(60, 500), (40, 530)]], 1.4, m), line)
    for s in (1, -1):
        x, y = leg_at(0.94)
        paint(img, I(yclip(legs(0.88, 0.94, 6), y - 8, y + 30), m), dk(hexc(col), 0.85))
        paint(img, I(ell(s * 38, 770, 10, 26), m), mix(hexc(col), WHITE, 0.18))
    return img

def bottom_skirt():
    col = "#2c3e6e"
    m = poly(sym([(58, 452), (76, 540), (96, 644)]))
    img, line = piece(m, col)
    paint(img, lines([[(x * 0.6, 460), (x, 640)] for x in (-80, -48, -16, 16, 48, 80)], 1.4, m), line)
    paint(img, lines([[(-120, y), (120, y)] for y in (510, 560, 610)], 1.2, m), mix(hexc(col), hexc("#c8323c"), 0.5))
    paint(img, yclip(m, 452, 466), dk(hexc(col), 0.8))
    return img

def bottom_aodai():
    col = "#f4f1ea"
    m = U(yclip(torso_mask(8), 466, 610), legs(0, 0.97, lambda t: 10 + 9 * t))
    img, line = piece(m, col, shade=0.88)
    paint(img, lines([[(s * 44, 640), (s * 50, 920)] for s in (1, -1)], 1.1, m), dk(hexc(col), 0.78))
    return img

def bottom_ninja():
    col = "#232a40"
    m = U(yclip(torso_mask(6), 466, 612), legs(0, 0.78, 6))
    img, line = piece(m, col)
    wrap = legs(0.74, 0.97, 4)
    w, wl = render(wrap, "#d8d0bc", sd=(5, 3)); img.alpha_composite(w)
    ys = [leg_at(t)[1] for t in (0.78, 0.83, 0.88, 0.93)]
    paint(img, lines([[(-80, y), (80, y + 10)] for y in ys], 1.2, wrap), wl)
    return img

def bottom_pants(col):
    m = U(yclip(torso_mask(5), 466, 612), legs(0, 0.92, 5))
    img, line = piece(m, col)
    paint(img, lines([[(0, 486), (0, 570)]], 1.3, m), line)
    return img

# --- shoes (slot "shoes", order below or above the bottom)
def shoes_sneaker():
    m = U(feet(6), legs(0.9, 1, 6))
    img, line = piece(m, "#f2f2f2", shade=0.85)
    paint(img, M(m, shift(m, 0, -7)), hexc("#9aa0a8"))
    for s in (1, -1): paint(img, lines([[(s * 34, 958), (s * 62, 950)]], 3, m), hexc("#d64541"))
    return img

def shoes_school():
    img = rgba_blank()
    socks = legs(0.52, 0.97, 2.5)
    render(socks, "#f4f4f4", img=img, shade=0.88)
    render(feet(5), "#5a3424", img=img, sd=(6, 4))
    return img

def shoes_sandal():
    img = rgba_blank()
    m = yclip(feet(3.5), 948, 990)
    render(m, "#c9a24a", img=img, sd=(5, 3))
    return img

def shoes_tabi():
    m = U(feet(4), legs(0.9, 1, 4))
    img, line = piece(m, "#1d1d24", shade=0.75)
    paint(img, lines([[(s * 40, 952), (s * 40, 975)] for s in (1, -1)], 1.4, m), mix(line, WHITE, 0.3))
    return img

def shoes_greaves():
    steel = "#aeb6bf"
    img = rgba_blank()
    _, line = render(U(legs(0.55, 1, 7), feet(8)), steel, img=img, sd=(7, 5))
    for s in (1, -1):
        kn = ell(s * 40, 770, 28, 24)
        render(kn, steel, img=img, sd=(6, 4))
        paint(img, ell(s * 36, 764, 8, 6), mix(hexc(steel), WHITE, 0.5))
    paint(img, lines([[(-80, y), (80, y)] for y in (850, 900, 952)], 1.3, U(legs(0.6, 1, 7), feet(8))), line)
    return img

def shoes_boots():
    img = rgba_blank()
    _, line = render(U(legs(0.7, 1, 6), feet(7)), "#4a2f20", img=img, sd=(6, 4))
    paint(img, legs(0.7, 0.74, 8), hexc("#6b4a33"))
    return img

# --- hats (slot "hat") and back (slot "back")
def hat_wizard():
    col = "#4b2c7a"
    img = rgba_blank()
    render(ell(0, 112, 96, 20), col, img=img, sd=(8, 5))
    cone = poly(smooth([(-52, 112), (-34, 70), (-10, 30), (20, 8), (60, 16), (28, 32), (32, 72), (52, 112)], 6))
    render(cone, col, img=img, sd=(8, 5))
    paint(img, yclip(cone, 92, 110), hexc("#e2b33c"))
    for cx, cy in [(-14, 70), (12, 44)]: paint(img, star(cx, cy, 6, 2.6, 4), hexc("#e2b33c"))
    return img

def hat_headband():
    img = rgba_blank()
    band = I(poly([(-80, 136), (80, 130), (80, 152), (-80, 158)]), head_mask(9))
    tails = U(poly([(62, 136), (112, 164), (118, 186), (66, 152)]), poly([(60, 146), (98, 204), (88, 214), (58, 156)]))
    render(tails, "#c0392b", img=img, sd=(5, 3))
    render(band, "#c0392b", img=img, sd=(6, 4))
    _, l = render(rect(-18, 134, 18, 154), "#9aa3ad", img=img, sd=(4, 3))
    paint(img, lines([[(-8, 144), (8, 144)], [(0, 138), (0, 150)]], 1.4), l)
    return img

def back_cape():
    col = "#9e1b2c"
    m = poly(sym([(78, 298), (104, 420), (120, 600), (130, 905)]))
    img, line = piece(m, col, shade=0.75, sd=(12, 8))
    paint(img, lines([[(x * 0.6, 340), (x, 900)] for x in (-110, -100, 100, 110)], 1.4, m), dk(hexc(col), 0.65))
    return img

# ---------------------------------------------------------------- catalogue + sorting layers
# The user's Sorting Layers: 0 Body, 1 Pants/Skirt, 2 Shirt/Armor, 3 Hair/Hat.
SORT = {"Body": 0, "PantsSkirt": 1, "ShirtArmor": 2, "HairHat": 3}
SLOTS = {  # slot: (sorting layer, order in layer, Vietnamese name)
    "aura":       ("Body", -30, "Hào quang"),
    "back":       ("Body", -20, "Sau lưng"),
    "hair_back":  ("Body", -10, "Tóc (phần sau lưng)"),
    "body":       ("Body", 0, "Cơ thể"),
    "face":       ("Body", 10, "Biểu cảm"),
    "shoes":      ("PantsSkirt", None, "Giày"),
    "bottom":     ("PantsSkirt", 0, "Quần / váy"),
    "top":        ("ShirtArmor", 0, "Áo"),
    "outer":      ("ShirtArmor", 10, "Áo bào / giáp"),
    "accessory":  ("ShirtArmor", 15, "Đồ đeo"),
    "neck":       ("ShirtArmor", 20, "Khăn cổ"),
    "weapon":     ("ShirtArmor", 30, "Vũ khí"),
    "hair_front": ("HairHat", 0, "Tóc (phần trước)"),
    "hat":        ("HairHat", 10, "Mũ / trang sức tóc"),
    "pet":        ("HairHat", 30, "Linh thú"),
}
UNISEX = {"hat", "pet"}

OUTFITS = [
    ("thuong_ngay", "Thường ngày", {"top": ("Áo thun", top_tee), "outer": ("Áo hoodie", outer_hoodie),
                                     "bottom": ("Quần jean", bottom_jeans), "shoes": ("Giày thể thao", shoes_sneaker, -5)}),
    ("hoc_sinh", "Học sinh", {"top": ("Sơ mi nơ đỏ", top_school), "bottom": ("Váy xếp ly", bottom_skirt),
                              "shoes": ("Tất cao + giày da", shoes_school, -5)}),
    ("ao_dai", "Áo dài", {"top": ("Áo dài đỏ", top_aodai), "bottom": ("Quần lụa trắng", bottom_aodai),
                          "shoes": ("Guốc", shoes_sandal, -5)}),
    ("vo_phuc", "Võ phục", {"top": ("Áo võ vạt chéo", top_ninja), "bottom": ("Quần bó + xà cạp", bottom_ninja),
                            "shoes": ("Giày tabi", shoes_tabi, 5), "hat": ("Băng đô", hat_headband)}),
    ("ky_si", "Kỵ sĩ", {"top": ("Áo lót giáp", top_gambeson), "outer": ("Giáp thép", outer_armor),
                        "bottom": ("Quần da", lambda: bottom_pants("#5b4a3a")), "shoes": ("Giáp chân", shoes_greaves, 5),
                        "back": ("Áo choàng đỏ", back_cape)}),
    ("phap_su", "Pháp sư", {"top": ("Áo trong", top_tunic), "outer": ("Áo choàng pháp sư", outer_robe),
                            "bottom": ("Quần tối", lambda: bottom_pants("#2e2438")), "shoes": ("Ủng da", shoes_boots, 5),
                            "hat": ("Mũ phù thủy", hat_wizard)}),
]

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); img.save(path, optimize=True)

def entry(pid, slot, name, file, order=None, group=None, gender=None, base=None):
    layer, default_order, slot_vi = SLOTS[slot]
    o = default_order if order is None else order
    return {"id": pid, "base": base or pid, "gender": gender, "slot": slot, "slot_vi": slot_vi, "name_vi": name, "file": file,
            "sortingLayer": layer, "sortingLayerIndex": SORT[layer], "orderInLayer": o, "set": group}

def render_piece(slot, fn):
    with space("hair" if slot == "hat" else "body"):
        return out(fn())

def main(od):
    import ancient
    parts = []
    for g, gname in GENDERS.items():
        set_gender(g)
        for k, (nm, hx) in SKINS.items():
            f = f"base/{g}/body_{k}.png"; save(body(hx, g), os.path.join(od, f))
            parts.append(entry(f"body_{k}__{g}", "body", f"{gname} – {nm}", f, gender=g, base=f"body_{k}"))
        for ex, exn in EXPRESSIONS.items():
            for k, (nm, hx) in EYES.items():
                f = f"base/{g}/face_{ex}_{k}.png"; save(face(ex, hx, g), os.path.join(od, f))
                parts.append(entry(f"face_{ex}_{k}__{g}", "face", f"{exn} – {nm}", f, gender=g, base=f"face_{ex}_{k}") | {"expression": ex, "eyes": k})
        print("base", g)
    set_gender("nu")
    for st in HAIR_STYLES:
        for ck, (cn, hx) in HAIR_COLORS.items():
            name, fi, bi = hair(st, hx)
            ff, fb = f"hair/{st}/{ck}_front.png", f"hair/{st}/{ck}_back.png"
            save(fi, os.path.join(od, ff)); save(bi, os.path.join(od, fb))
            parts.append(entry(f"hair_{st}_{ck}_front", "hair_front", f"{name} – {cn}", ff, group=st) | {"color": ck})
            parts.append(entry(f"hair_{st}_{ck}_back", "hair_back", f"{name} – {cn}", fb, group=st) | {"color": ck})
        print("hair", st)

    def add_piece(base, slot, nm, fn, order, group, folder):
        if slot in UNISEX:
            f = f"{folder}/{slot}.png"; save(render_piece(slot, fn), os.path.join(od, f))
            parts.append(entry(base, slot, nm, f, order, group, base=base))
        else:
            for g in GENDERS:
                set_gender(g)
                f = f"{folder}/{g}/{slot}.png"; save(render_piece(slot, fn), os.path.join(od, f))
                parts.append(entry(f"{base}__{g}", slot, nm, f, order, group, gender=g, base=base))
            set_gender("nu")

    for pid, slot, nm, fn, order in ancient.EXTRAS:
        add_piece(pid, slot, nm, fn, order, "phu_kien", f"extras/{pid}")
    print("extras", len(ancient.EXTRAS))
    sets = []
    for sid, sname, pieces, look in ancient.OUTFITS:
        mapping = {}
        for slot, spec in pieces.items():
            if isinstance(spec, str):            # reference to an extra
                mapping[slot] = spec; continue
            nm, fn = spec[0], spec[1]; order = spec[2] if len(spec) > 2 else None
            base = f"{sid}_{slot}"
            add_piece(base, slot, nm, fn, order, sid, f"outfits/{sid}")
            mapping[slot] = base
        sets.append({"id": sid, "name_vi": sname, "parts": mapping, "suggest": look})
        print("outfit", sid)
    manifest = {
        "format": "modular-character.v2", "canvas": {"w": W, "h": H}, "pixelArt": {"pixelSize": PIX, "grid": [W // PIX, H // PIX]},
        "pivot": {"x": 0.5, "y": round(1 - GROUND / H, 4), "note": "Unity pivot (bottom-left origin) at the feet; every part uses the same canvas and pivot."},
        "pixelsPerUnit": 256,
        "genders": [{"id": k, "name_vi": v} for k, v in GENDERS.items()],
        "expressions": [{"id": k, "name_vi": v} for k, v in EXPRESSIONS.items()],
        "eyeColors": [{"id": k, "name_vi": v[0], "hex": v[1]} for k, v in EYES.items()],
        "skins": [{"id": k, "name_vi": v[0], "hex": v[1]} for k, v in SKINS.items()],
        "hairStyles": [{"id": st, "name_vi": hair_shapes(st)[0]} for st in HAIR_STYLES],
        "hairColors": [{"id": k, "name_vi": v[0], "hex": v[1]} for k, v in HAIR_COLORS.items()],
        "sortingLayers": [{"name": n, "index": i} for n, i in SORT.items()],
        "slots": {k: {"sortingLayer": v[0], "orderInLayer": v[1], "name_vi": v[2], "unisex": k in UNISEX or k.startswith("hair")} for k, v in SLOTS.items()},
        "notes": {"ids": "Gendered parts use id '<base>__nam' / '<base>__nu'. Outfit sets list base ids; resolve with the current gender, falling back to the base id.",
                  "hair": "Each hairstyle has a _front part (HairHat layer) and a _back part (Body layer, behind the body). Use both.",
                  "shoes": "Shoes sit in PantsSkirt: negative order = under the trouser hem, positive = over it (boots).",
                  "back": "Capes, ribbons and back items go behind the body in the Body layer with a negative order; auras are lowest."},
        "outfitSets": sets, "parts": parts,
    }
    json.dump(manifest, open(os.path.join(od, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(len(parts), "parts")

if __name__ == "__main__":
    import modular   # single module instance, so ancient.py shares the same drawing space state
    modular.main(sys.argv[1] if len(sys.argv) > 1 else "out")
