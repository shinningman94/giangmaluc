"""Cổ trang outfits and hairstyles, drawn on the same canvas/body as modular.py."""
import math
from modular import *
import modular as _m

# ---------------------------------------------------------------- shared helpers
def bell(end=0.88, p0=8, p1=28):
    return arms(0, end, lambda t: p0 + (p1 - p0) * (t / end) ** 2)

def bell_cuff(end=0.88, p0=8, p1=28, w=0.07):
    f = lambda t: p0 + (p1 - p0) * (t / end) ** 2
    return M(arms(0, end, f), arms(0, end - w, f))

def robe_mask(pad=8, waist=470, hem=900, hw_hem=104, y_top=262):
    tor = yclip(torso_mask(pad), y_top, waist + 6)
    skirt = poly(sym([(58 + pad * 0.3, waist - 14), (72, 560), (84, 668), (hw_hem, hem)]))
    return U(tor, skirt)

def ring(cx, cy, r, w): return M(ell(cx, cy, r, r), ell(cx, cy, r - w, r - w))

def cloud(cx, cy, r, m=None):
    m = m or blank()
    for dx, dy, rr in ((0, 0, r), (r * 1.1, r * 0.25, r * 0.75), (-r * 1.05, r * 0.3, r * 0.7)):
        m = U(m, M(ell(cx + dx, cy + dy, rr, rr), ell(cx + dx + rr * 0.2, cy + dy - rr * 0.15, rr * 0.55, rr * 0.55)))
    return m

def cross_collar(clip, col, img, w=12):
    """giao lĩnh hữu nhẫm: left panel over right — collar runs from the wearer's left neck to the wearer's right underarm."""
    if _m.VIEW() in ("back", "bq"): return blank()
    band = U(poly([(8, 270), (8 + w * 1.3, 278), (-56, 456), (-56 - w, 446)]),
             poly([(-22, 278), (-10, 272), (6, 318), (-4, 324)]))
    render(I(band, grow(clip, 2)), col, img=img, sd=(3, 2), lw=1.4)
    return band

def scales(clip, y0, y1, step=11, w=15):
    m = blank()
    for row, y in enumerate(range(int(y0), int(y1), step)):
        off = (w / 2) if row % 2 else 0
        x = -130 + off
        while x < 130:
            m = U(m, yclip(M(ell(x, y, w / 2, step), ell(x, y - 2.2, w / 2 - 1.8, step - 1.6)), y, y + step))
            x += w
    return I(m, clip)

def tassel(x, y, length, col, img):
    render(lines([[(x, y), (x, y + length * 0.35)]], 1.6), "#444444", img=img, shade=0, lw=0.6)
    render(poly([(x - 4, y + length * 0.35), (x + 4, y + length * 0.35), (x + 7, y + length), (x - 7, y + length)]), col, img=img, sd=(2, 2), lw=1)

# ---------------------------------------------------------------- 1. Hiệp khách (theo ảnh tham khảo: lãng khách nón tre)
def jag(x0, x1, y, depth=26, n=7):
    pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        pts.append((x, y + (depth if i % 2 else 0)))
    return pts

def hk_inner():
    col = "#d9cbb0"
    tor = M(yclip(torso_mask(4), 266, 498), ell(0, 282, 16, 12)); sl = arms(0, 0.8, 5)
    img, _ = render(U(tor, sl), col, seams=[seam(sl, tor, 336)], shade=0.84)
    return img

def hk_robe():
    col = "#4f5d70"; cream = "#d9cbb0"
    sl = arms(0, 0.5, lambda t: 9 + 4 * t)
    tor = yclip(torso_mask(8), 262, 480)
    skirt = poly(sym([(62, 470), (74, 560), (84, 660)]) [:0] + [(-62, 470), (62, 470), (76, 560)] + jag(86, -86, 700, 30, 8) + [(-76, 560)])
    front = poly([(-26, 470), (26, 470), (32, 690), (-32, 690)])                      # cream front panel
    m = U(tor, sl, skirt)
    img, line = render(m, col, seams=[seam(sl, tor, 336)])
    render(I(front, grow(m, 2)), cream, img=img, sd=(4, 3))
    render(M(arms(0.42, 0.5, 13), arms(0, 0.42, 13)), cream, img=img, sd=(3, 2))   # rolled cuffs
    cross_collar(m, cream, img, 14)
    sash = yclip(torso_mask(11), 452, 486)
    render(sash, "#8e2f2a", img=img, sd=(4, 3))
    render(U(poly([(-10, 482), (4, 482), (0, 600), (-14, 598)]), poly([(4, 482), (16, 482), (22, 580), (10, 584)])), "#8e2f2a", img=img, sd=(3, 2))
    render(ell(34, 500, 14, 16), "#7a5a3a", img=img, sd=(4, 3))                      # pouch
    return img

def hk_cloak():
    col = "#3f4b5c"
    m = poly([(-82, 300), (82, 300), (108, 420), (124, 560)] + jag(132, -132, 790, 40, 9) + [(-124, 560), (-108, 420)])
    img, line = render(m, col, shade=0.78, sd=(10, 8))
    return img

def hk_hat():
    img = rgba_blank()
    render(lines([[(-50, 128), (-40, 244)], [(50, 128), (40, 244)]], 6), "#3a2a1a", img=img, shade=0, lw=0.5)
    brim = [(-124, 124)] + [(-124 + 248 * i / 12, 124 + (8 if i % 2 else 0)) for i in range(1, 12)] + [(124, 124)]
    cone = poly(brim[::-1] + [(-118, 120), (-60, 92), (-14, 62), (14, 62), (60, 92), (118, 120)][::-1][::-1])
    _, l = render(cone, "#a5805a", img=img, sd=(10, 6))
    paint(img, lines([[(0, 64), (x, 124)] for x in (-80, -30, 30, 80)], 6, cone), dk(hexc("#a5805a"), 0.72))
    render(ell(0, 62, 14, 10), "#26222c", img=img, sd=(3, 3), lw=1.2)
    return img

# ---------------------------------------------------------------- 2. Tiên nữ (Hán phục)
def tn_top():
    col = "#f2c6d0"
    sl = bell(0.9, 6, 30); tor = yclip(torso_mask(5), 262, 502)
    m = U(tor, sl)
    img, line = render(m, col, seams=[seam(sl, tor, 336)], shade=0.86)
    paint(img, I(bell_cuff(0.9, 6, 30), m), hexc("#ffffff"))
    cross_collar(m, "#ffffff", img, 10)
    sash = yclip(torso_mask(9), 446, 482)
    render(sash, "#b8456a", img=img, sd=(4, 3))
    render(U(poly([(-6, 476), (6, 476), (14, 720), (2, 724)]), poly([(4, 476), (-6, 476), (-18, 690), (-8, 694)])), "#b8456a", img=img, sd=(3, 2))
    render(ell(0, 470, 10, 8), "#e6b84a", img=img, sd=(2, 2), lw=1.2)
    return img

def tn_skirt():
    col = "#f8eef2"
    m = poly(sym([(58, 450), (70, 560), (80, 668), (100, 820), (116, 946)]))
    img, line = render(m, col, shade=0.9)
    paint(img, yclip(m, 860, 950), hexc("#f2b8c8"))
    paint(img, lines([[(x * 0.55, 470), (x, 940)] for x in (-90, -50, -14, 22, 60, 96)], 1.1, m), dk(hexc(col), 0.8))
    fl = blank()
    for cx, cy in [(-70, 900), (-24, 912), (26, 904), (72, 914)]: flower(cx, cy, 5, fl)
    paint(img, I(fl, m), hexc("#ffffff"))
    return img

def tn_ribbon():
    img = rgba_blank()
    for s in (1, -1):
        r = lines([smooth([(s * 50, 300), (s * 92, 312), (s * 112, 390), (s * 132, 480), (s * 144, 580), (s * 150, 690),
                           (s * 140, 800), (s * 150, 870)], 6)], 11)
        u, _ = render(r, "#bfe3ef", sd=(3, 2), lw=1.3)
        u.putalpha(u.getchannel("A").point(lambda v: int(v * 0.88)))
        img.alpha_composite(u)
    return img

def tn_pin():
    img = rgba_blank()
    render(lines([[(30, 96), (86, 128)]], 3), "#c9a24a", img=img, shade=0, lw=1)
    render(flower(36, 98, 7), "#e6b84a", img=img, sd=(2, 2), lw=1.2)
    paint(img, ell(36, 98, 3, 3), hexc("#c8323c"))
    for k, dx in enumerate((-6, 0, 6)):
        render(lines([[(40 + dx, 106), (44 + dx, 140 + k * 6)]], 1), "#c9a24a", img=img, shade=0, lw=0.4)
        render(ell(44 + dx, 143 + k * 6, 2.6, 2.6), "#e8eef5", img=img, shade=0, lw=0.8)
    return img

def tn_shoes():
    img = rgba_blank()
    render(yclip(feet(4), 944, 990), "#b8456a", img=img, sd=(4, 3))
    return img

# ---------------------------------------------------------------- 3. Tướng quân
def tq_under():
    col = "#7a1f1f"
    tor = yclip(torso_mask(5), 262, 480); sl = arms(0, 0.94, 5)
    skirt = poly(sym([(60, 470), (72, 560), (82, 660), (86, 760)]))
    m = U(tor, sl, skirt)
    img, line = render(m, col, seams=[seam(sl, U(tor, skirt), 336)])
    return img

def tq_armor():
    bronze = "#8c7a55"; gold = "#d9b24a"
    img = rgba_blank()
    render(arms(0.58, 0.93, 7), "#5a3a2a", img=img, sd=(5, 3))
    plate = yclip(torso_mask(11), 294, 500)
    _, line = render(plate, bronze, img=img, sd=(10, 6))
    paint(img, scales(plate, 300, 500), dk(hexc(bronze), 0.62))
    render(ring(0, 380, 26, 7), gold, img=img, sd=(3, 3), lw=1.4)
    render(ell(0, 380, 19, 19), "#c7ccd2", img=img, sd=(5, 4), lw=1)
    paint(img, ell(-6, 373, 6, 5), WHITE)
    skirt = poly(sym([(70, 488), (82, 560), (94, 690)]))
    sk, sl_ = render(M(skirt, rect(-8, 500, 8, 700)), bronze, sd=(8, 5)); img.alpha_composite(sk)
    paint(img, scales(M(skirt, rect(-8, 500, 8, 700)), 500, 690), dk(hexc(bronze), 0.62))
    render(yclip(torso_mask(13), 482, 504), "#3b2418", img=img, sd=(4, 3))
    beast = U(ell(0, 494, 18, 14))
    render(beast, gold, img=img, sd=(3, 3), lw=1.4)
    paint(img, lines([[(-8, 498), (8, 498)]], 2.4), hexc("#3b2418"))
    for s in (1, -1):
        pa = U(ell(s * 84, 322, 33, 26), ell(s * 92, 350, 28, 18))
        render(pa, gold, img=img, sd=(7, 5))
        paint(img, ell(s * 92, 328, 10, 7), hexc("#3b2418"))            # beast mouth
        for k in (-6, 0, 6): paint(img, poly([(s * 92 + k - 2, 322), (s * 92 + k + 2, 322), (s * 92 + k, 330)]), WHITE)
        paint(img, ell(s * 80, 314, 3, 3), hexc("#b8302a"))
    render(poly([(-26, 270), (26, 270), (34, 300), (-34, 300)]), bronze, img=img, sd=(4, 3))
    return img

def tq_helmet():
    bronze = "#8c7a55"; gold = "#d9b24a"
    img = rgba_blank()
    tas = poly(smooth([(-6, 54), (6, 54), (22, 30), (10, 18), (0, 8), (-12, 20), (-22, 32)], 4))
    render(tas, "#c0282f", img=img, sd=(4, 3))
    render(rect(-4, 50, 4, 92), gold, img=img, sd=(2, 2), lw=1.2)
    dome = yclip(ell(0, 158, 72, 80), 0, 156)
    flaps = U(poly(smooth([(56, 140), (80, 146), (84, 232), (64, 240), (60, 180)], 4)),
              poly(smooth([(-56, 140), (-80, 146), (-84, 232), (-64, 240), (-60, 180)], 4)))
    _, l = render(U(dome, flaps), bronze, img=img, sd=(8, 5))
    paint(img, lines([[(0, 82), (0, 152)], [(-40, 98), (-30, 152)], [(40, 98), (30, 152)]], 1.4, dome), l)
    render(yclip(U(ell(0, 158, 74, 82)), 140, 158), gold, img=img, sd=(4, 3))
    render(poly([(-10, 150), (10, 150), (0, 176)]), gold, img=img, sd=(2, 2), lw=1.2)
    return img

def tq_cape():
    col = "#b0202a"
    m = poly(sym([(80, 296), (108, 420), (124, 600), (136, 900)]))
    img, line = render(m, col, shade=0.75, sd=(12, 8))
    paint(img, lines([[(x * 0.6, 340), (x, 896)] for x in (-118, -104, 104, 118)], 1.4, m), dk(hexc(col), 0.65))
    return img

def boots(col, trim=None, lo=0.68):
    img = rgba_blank()
    render(U(legs(lo, 1, 6), feet(7)), col, img=img, sd=(6, 4))
    if trim: paint(img, legs(lo, lo + 0.04, 8), hexc(trim))
    return img

# ---------------------------------------------------------------- 4. Quan văn
def qv_robe():
    col = "#a3202b"
    sl = bell(0.88, 9, 28); body_ = robe_mask(9, 474, 930, 112)
    m = U(body_, sl)
    img, line = render(m, col, seams=[seam(sl, body_, 336)])
    render(I(ring(0, 290, 24, 7), m), "#e9e4d6", img=img, sd=(2, 2), lw=1.2)
    paint(img, lines([[(18, 300), (66, 340)]], 1.4, m), line)
    badge = rect(-40, 340, 40, 420)
    render(badge, "#1e2a4a", img=img, shade=0, lw=1.6)
    paint(img, I(cloud(-18, 400, 7), badge), hexc("#e6b84a"))
    paint(img, I(cloud(20, 360, 6), badge), hexc("#e6b84a"))
    render(lines([smooth([(-14, 372), (0, 360), (14, 376), (6, 392)], 4)], 3), "#ffffff", img=img, shade=0, lw=0.8)
    paint(img, I(bell_cuff(0.88, 9, 28), m), dk(hexc(col), 0.75))
    belt = poly(smooth([(-74, 462), (0, 482), (74, 462), (74, 476), (0, 496), (-74, 476)], 4))
    render(belt, "#e6b84a", img=img, sd=(3, 2))
    for x in (-50, -24, 0, 24, 50): paint(img, rect(x - 5, 470 + (6 if abs(x) < 30 else 0), x + 5, 482 + (6 if abs(x) < 30 else 0)), hexc("#3fa37a"))
    paint(img, I(cloud(-60, 860, 9), m), dk(hexc(col), 0.72)); paint(img, I(cloud(60, 820, 9), m), dk(hexc(col), 0.72))
    return img

def qv_hat():
    img = rgba_blank()
    for s in (1, -1):
        render(ell(s * 112, 122, 42, 8), "#1d1b22", img=img, sd=(4, 2))
    render(ell(0, 100, 40, 32), "#1d1b22", img=img, sd=(6, 4))
    cap = yclip(ell(0, 158, 70, 70), 0, 158)
    render(cap, "#1d1b22", img=img, sd=(8, 5))
    paint(img, I(ell(-22, 112, 18, 10), cap), hexc("#4a4656"))
    return img

def plain(col, t1=0.36):
    def f():
        img, _ = render(U(M(yclip(torso_mask(4), 266, 498), ell(0, 282, 16, 12)), arms(0, t1, 5)), col, shade=0.86)
        return img
    return f

# ---------------------------------------------------------------- 5. Áo tứ thân
def tt_yem():
    col = "#c8323c"
    m = I(yclip(torso_mask(3), 300, 498), poly([(-30, 296), (30, 296), (62, 360), (60, 498), (-60, 498), (-62, 360)]))
    img, line = render(M(m, grow(arms(0.08, 1), 1.8)), col, sd=(6, 4))
    paint(img, lines([[(-28, 298), (-14, 268)], [(28, 298), (14, 268)]], 2.2), dk(hexc(col), 0.8))
    return img

def tt_ao():
    col = "#7a5a3a"
    opening = poly([(-16, 270), (16, 270), (36, 470), (24, 830), (-24, 830), (-36, 470)])
    body_ = M(U(yclip(torso_mask(7), 262, 480), poly(sym([(62, 470), (72, 560), (82, 668), (92, 830)]))), opening)
    sl = arms(0, 0.97, 5)
    m = U(body_, sl)
    img, line = render(m, col, seams=[seam(sl, body_, 336)])
    paint(img, lines([[(s * 18, 274), (s * 38, 472)] for s in (1, -1)], 3.5, grow(m, 1)), dk(hexc(col), 0.8))
    sash = yclip(torso_mask(9), 452, 480)
    render(sash, "#3aa36b", img=img, sd=(4, 3))
    render(U(poly([(-4, 476), (8, 476), (16, 640), (4, 644)]), poly([(4, 476), (-8, 476), (-20, 620), (-8, 624)])), "#3aa36b", img=img, sd=(3, 2))
    render(U(poly([(30, 470), (60, 520), (44, 528)]), poly([(36, 470), (14, 540), (2, 532)])), col, img=img, sd=(3, 2))
    return img

def tt_skirt():
    m = poly(sym([(58, 452), (70, 560), (80, 668), (88, 920)]))
    img, line = render(m, "#1e1a1e", shade=0.82)
    paint(img, lines([[(x * 0.6, 470), (x, 914)] for x in (-60, -20, 20, 60)], 1, m), hexc("#3a3440"))
    return img

def tt_hat():
    img = rgba_blank()
    for s in (1, -1):
        render(lines([[(s * 70, 120), (s * 66, 270)], [(s * 76, 120), (s * 74, 262)]], 1.2), "#1d1b22", img=img, shade=0, lw=0.4)
        render(ell(s * 70, 276, 5, 8), "#1d1b22", img=img, shade=0, lw=0.6)
    _, l = render(ell(0, 116, 120, 16), "#d8b46a", img=img, sd=(8, 4))
    render(yclip(ell(0, 108, 52, 18), 0, 112), "#d8b46a", img=img, sd=(5, 3))
    paint(img, lines([[(-104, 118), (104, 118)]], 1.1, ell(0, 116, 120, 16)), l)
    return img

def tt_shoes():
    img = rgba_blank()
    m = U(yclip(feet(4), 946, 992), U(*[poly([(s * 40, 952), (s * 50, 936), (s * 58, 954)]) for s in (1, -1)]))
    render(m, "#6b3a22", img=img, sd=(4, 3))
    return img

# ---------------------------------------------------------------- 6. Thích khách
def tk_suit():
    col = "#241c2c"
    tor = M(yclip(torso_mask(5), 262, 562), ell(0, 280, 14, 10)); sl = arms(0, 0.95, 4)
    img, line = render(U(tor, sl), col, seams=[seam(sl, tor, 336)])
    return img

def tk_gear():
    img = rgba_blank()
    _, l = render(arms(0.6, 0.95, 7), "#5a3a2a", img=img, sd=(5, 3))
    for t in (0.66, 0.74, 0.82, 0.9):
        for s_ in (1, -1):
            x, y = arm_at(t, s_)
            paint(img, lines([[(x - 10, y - 4), (x + 10, y + 4)]], 1.2), l)
    strap = lines([[(-62, 306), (64, 500)]], 13)
    render(strap, "#3b2418", img=img, sd=(3, 2))
    for k in range(4):
        x = -40 + k * 26; y = 340 + k * 40
        render(poly([(x - 3, y - 14), (x + 3, y - 14), (x + 2, y + 10), (x, y + 16), (x - 2, y + 10)]), "#c7ccd2", img=img, sd=(1, 1), lw=1)
    render(U(ell(-84, 322, 30, 22), ell(-90, 346, 24, 14)), "#5a3a2a", img=img, sd=(6, 4))
    render(yclip(torso_mask(10), 452, 476), "#6b1f2a", img=img, sd=(4, 3))
    render(poly([(-30, 470), (-52, 560), (-40, 562), (-22, 474)]), "#6b1f2a", img=img, sd=(3, 2))
    return img

def tk_mask():
    img = rgba_blank()
    m = I(yclip(head_mask(4), 202, 270), U(head_mask(4), rect(-70, 240, 70, 270)))
    m = U(m, poly(smooth([(-44, 250), (44, 250), (30, 278), (0, 286), (-30, 278)], 4)))
    _, l = render(m, "#2b2232", img=img, sd=(5, 3))
    paint(img, lines([[(-40, 222), (40, 222)]], 1, m), dk(hexc("#2b2232"), 0.6))
    return img

def tk_pants():
    img, l = render(U(yclip(torso_mask(5), 466, 612), legs(0, 0.8, 4)), "#1b1620")
    w, wl = render(legs(0.76, 0.97, 4.5), "#4a3a48", sd=(4, 3)); img.alpha_composite(w)
    paint(img, lines([[(-80, leg_at(t)[1]), (80, leg_at(t)[1] + 10)] for t in (0.8, 0.86, 0.92)], 1.2, legs(0.76, 0.97, 4.5)), wl)
    return img

# ---------------------------------------------------------------- hairstyles
def hk_pants():
    m = U(yclip(torso_mask(8), 466, 612), legs(0, 0.86, lambda t: 9 + 6 * t))
    img, line = render(m, "#3c3638")
    return img

def hk_shoes():
    img = rgba_blank()
    m = U(legs(0.82, 1, 7), feet(7))
    render(m, "#1d1b22", img=img, sd=(4, 3))
    paint(img, I(M(m, shift(m, 0, -4)), rect(-200, 940, 200, 1000)), hexc("#e8e4dc"))
    return img

def hair_shapes_ancient(style):
    r = hair_shapes_new(style)
    if r: return r
    if style == "co_trang_nam":
        front = U(yclip(ell(0, 165, 68, 76), 0, 140),
                  poly(smooth([(54, 138), (64, 142), (70, 260), (76, 380), (66, 386), (60, 270), (52, 180)], 6)),
                  poly(smooth([(-54, 138), (-64, 142), (-70, 260), (-76, 380), (-66, 386), (-60, 270), (-52, 180)], 6)))
        back = U(ell(0, 172, 72, 80), ell(0, 84, 22, 20),
                 poly(smooth([(-74, 190), (74, 190), (84, 400), (78, 560), (40, 590), (0, 570), (-40, 590), (-78, 560), (-84, 400)], 6)))
        return "Cổ trang (búi tó)", front, back
    if style == "co_trang_nu":
        bang = U(poly([(-62, 136), (-6, 136), (-10, 166), (-30, 176), (-48, 168)]), poly([(62, 136), (6, 136), (10, 166), (30, 176), (48, 168)]))
        front = U(yclip(ell(0, 165, 70, 76), 0, 140), bang, side_lock(1, 300, 12, 58), side_lock(-1, 300, 12, 58))
        loops = [M(ell(s * 44, 96, 24, 28), ell(s * 46, 98, 11, 14)) for s in (1, -1)]
        back = U(ell(0, 172, 74, 82), *loops,
                 poly(smooth([(-76, 190), (76, 190), (86, 420), (80, 610), (0, 640), (-80, 610), (-86, 420)], 6)))
        return "Cổ trang (song hoàn)", front, back
    raise ValueError(style)

def hair_extras(style, bimg):
    hair_extras_new(style, bimg)
    if style == "co_trang_nam":
        render(lines([[(-14, 96), (-60, 150), (-54, 200)], [(-10, 98), (-40, 170)]], 9), "#3f6fa8", img=bimg, sd=(2, 2), lw=1)
        render(ell(-8, 98, 12, 8), "#3f6fa8", img=bimg, sd=(2, 2), lw=1)
    if style == "co_trang_nu":
        for s in (1, -1):
            render(ell(s * 30, 118, 8, 6), "#c8323c", img=bimg, sd=(2, 2), lw=1.2)
            render(lines([[(s * 30, 122), (s * 36, 190)]], 4), "#c8323c", img=bimg, shade=0, lw=1)

ANCIENT_HAIR = ["co_trang_nam", "co_trang_nu"]

# ---------------------------------------------------------------- shared ornament helpers
def erode(m, r):
    k = max(1, round(r * S)); return m.filter(ImageFilter.MinFilter(2 * k + 1))
def trim(m, r=4): return M(m, erode(m, r))

def key_band(x0, x1, y0, y1, step=16):
    m = blank(); x = x0
    while x + step - 3 <= x1:
        outer = rect(x, y0, x + step - 3, y1); inner = rect(x + 4, y0 + 4, x + step - 7, y1 - 4)
        m = U(m, M(outer, inner), rect(x + 6, y0 + 6, x + step - 9, y1 - 6)); x += step
    return m

def wisp(cx, cy, r):
    return U(ell(cx, cy, r, r), poly([(cx - r * 0.8, cy - r * 0.3), (cx + r * 0.3, cy - r * 2.6), (cx + r * 0.8, cy - r * 0.2)]))

# ---------------------------------------------------------------- new hairstyles
def _spike_ring(tips, c=(0, 165), rad=66, half=0.24):
    out_ = []
    for tx, ty in tips:
        a = math.atan2(ty - c[1], tx - c[0])
        out_.append(poly([(c[0] + math.cos(a - half) * rad, c[1] + math.sin(a - half) * rad), (tx, ty),
                          (c[0] + math.cos(a + half) * rad, c[1] + math.sin(a + half) * rad)]))
    return U(*out_)

def hair_shapes_new(style):
    if style == "kiem_tien":
        cap_ = yclip(ell(0, 165, 70, 76), 0, 146)
        lock_l = poly(smooth([(-8, 104), (-42, 122), (-64, 168), (-68, 240), (-62, 330), (-48, 362), (-50, 280), (-46, 204), (-30, 156), (-10, 132)], 5))
        lock_r = poly(smooth([(8, 104), (42, 122), (62, 168), (64, 236), (58, 300), (46, 320), (48, 250), (44, 190), (30, 152), (10, 132)], 5))
        strand = poly([(4, 108), (22, 150), (16, 194), (10, 150)])
        front = U(cap_, lock_l, lock_r, strand)
        back = U(ell(0, 172, 76, 84), ell(0, 84, 26, 24),
                 poly(smooth([(78, 190), (88, 380), (86, 520), (70, 620), (40, 600), (0, 640), (-40, 600), (-80, 620), (-104, 560),
                              (-128, 600), (-150, 540), (-130, 420), (-104, 300), (-78, 190)], 6)),
                 poly(smooth([(-78, 236), (-150, 300), (-178, 350), (-150, 352), (-96, 300)], 4)),
                 poly(smooth([(-70, 300), (-140, 420), (-170, 470), (-140, 462), (-90, 380)], 4)))
        return "Kiếm tiên (búi cao, tóc dài bay)", front, back
    if style == "thieu_nien":
        cap_ = yclip(ell(0, 160, 72, 80), 0, 150)
        top = _spike_ring([(-96, 100), (-74, 60), (-42, 38), (-6, 26), (30, 34), (62, 52), (92, 84), (104, 128)])
        bangs = U(*[poly([(bx - 16, 140), (tx, ty), (bx + 16, 140)]) for bx, tx, ty in
                    [(-46, -50, 196), (-22, -18, 184), (2, 8, 202), (26, 30, 184), (50, 54, 192)]])
        sides = U(poly([(-58, 140), (-80, 236), (-64, 226), (-70, 260), (-50, 190)]), poly([(58, 140), (80, 236), (64, 226), (70, 258), (50, 190)]))
        front = U(cap_, top, bangs, sides)
        back = U(ell(0, 168, 76, 84), poly([(-70, 200), (-98, 250), (-62, 236)]), poly([(70, 200), (98, 250), (62, 236)]),
                 poly([(-40, 230), (-50, 268), (-20, 246)]), poly([(40, 230), (50, 268), (20, 246)]))
        return "Thiếu niên (tóc rối)", front, back
    return None

def hair_extras_new(style, bimg):
    if style == "kiem_tien":
        render(lines([[(-16, 88), (-70, 98), (-120, 132), (-160, 124)], [(-14, 94), (-58, 126), (-96, 178), (-112, 220)]], 9), "#c0282f", img=bimg, sd=(3, 2), lw=1.2)

# ---------------------------------------------------------------- set: Kiếm tiên thanh y (ảnh mẫu 1)
JADE = "#3fbf9a"; GOLD = "#d4a845"

def kt_pants():
    m = U(yclip(torso_mask(8), 466, 612), legs(0, 0.95, lambda t: 10 + 12 * t))
    img, line = render(m, "#e4e1d6", shade=0.86)
    paint(img, lines([[(s * 30, 640), (s * 44, 920)] for s in (1, -1)] + [[(s * 56, 700), (s * 64, 930)] for s in (1, -1)], 4, m), dk(hexc("#e4e1d6"), 0.78))
    return img

def kt_robe():
    col = "#1f4a3e"; light = hexc("#5f9c84")
    sl = bell(0.86, 9, 30); tor = yclip(torso_mask(9), 262, 482)
    skirt = poly([(-62, 470), (62, 470), (76, 560), (90, 680)] + jag(104, -104, 860, 34, 10) + [(-90, 680), (-76, 560)])
    opening = poly([(-18, 482), (18, 482), (44, 900), (-44, 900)])
    m = U(tor, sl, M(skirt, opening))
    img, line = render(m, col, seams=[seam(sl, tor, 336)])
    paint(img, I(m, rect(-300, 760, 300, 820)), mix(hexc(col), light, 0.3))
    paint(img, I(m, rect(-300, 820, 300, 1000)), mix(hexc(col), light, 0.55))
    paint(img, I(trim(m, 4), rect(-300, 262, 300, 1000)), hexc(GOLD))
    paint(img, I(bell_cuff(0.86, 9, 30, 0.06), m), hexc("#ece6d6"))
    for c in [(-62, 740, 9), (66, 680, 8), (-30, 600, 7)]: paint(img, I(cloud(*c), m), dk(hexc(GOLD), 0.75))
    cross_collar(m, "#ece6d6", img, 13)
    for sx_ in (1, -1):
        pa = ell(sx_ * 80, 318, 25, 18)
        render(pa, GOLD, img=img, sd=(4, 3))
        render(ell(sx_ * 80, 318, 7, 7), JADE, img=img, sd=(2, 2), lw=1.2)
    render(yclip(torso_mask(11), 450, 486), "#a8262c", img=img, sd=(4, 3))
    render(U(poly([(-12, 482), (2, 482), (-4, 650), (-18, 646)]), poly([(4, 482), (16, 482), (24, 620), (12, 624)])), "#a8262c", img=img, sd=(3, 2))
    render(ring(0, 468, 13, 6), JADE, img=img, sd=(2, 2), lw=1.4)
    return img

def kt_ribbons():
    img = rgba_blank()
    r = lines([smooth([(-30, 470), (-110, 520), (-170, 600), (-160, 720), (-190, 800)], 6),
               smooth([(30, 470), (-40, 560), (-120, 660), (-130, 780), (-150, 860)], 6)], 11)
    render(r, "#b0262d", img=img, sd=(3, 2))
    return img

# ---------------------------------------------------------------- set: Thiếu niên du hiệp (ảnh mẫu 2)
NAVY = "#26305c"; CREAM = "#efe6cf"

def dh_tunic():
    tor = yclip(torso_mask(5), 262, 482); sl = arms(0, 0.78, 5)
    panel = poly([(-48, 470), (48, 470), (58, 744), (30, 766), (0, 744), (-30, 766), (-58, 744)])
    m = U(tor, sl, panel)
    img, line = render(m, CREAM, seams=[seam(sl, tor, 336)], shade=0.86)
    paint(img, I(key_band(-52, 52, 700, 714), m), hexc(GOLD))
    paint(img, I(U(rect(-50, 560, -46, 744), rect(46, 560, 50, 744)), m), hexc(GOLD))
    paint(img, I(cloud(-22, 620, 8), m), dk(hexc(GOLD), 0.9))
    cross_collar(m, CREAM, img, 12)
    paint(img, lines([[(8, 274), (-56, 452)]], 4, m), hexc(GOLD))
    return img

def dh_jacket():
    opening = poly([(-8, 266), (8, 266), (56, 610), (-56, 610)])
    tor = M(yclip(torso_mask(9), 262, 610), opening)
    sides = U(poly([(-84, 480), (-54, 480), (-56, 720), (-96, 700)]), poly([(84, 480), (54, 480), (56, 720), (96, 700)]))
    sl = arms(0, 0.52, lambda t: 10 + 16 * t)
    m = U(tor, sides, sl)
    img, line = render(m, NAVY, seams=[seam(sl, tor, 336)])
    paint(img, I(trim(m, 4), rect(-300, 262, 300, 1000)), hexc(GOLD))
    for sx_ in (1, -1):
        x, y = arm_at(0.36, sx_)
        paint(img, I(key_band(x - 14, x + 14, y - 8, y + 6, 14), m), hexc(GOLD))
        paint(img, I(key_band(sx_ * 62 - 14, sx_ * 62 + 14, 640, 654, 14), m), hexc(GOLD))
    rope = yclip(torso_mask(12), 452, 478)
    _, rl = render(rope, "#c0282f", img=img, sd=(3, 2))
    paint(img, lines([[(x, 452), (x + 10, 478)] for x in range(-90, 90, 10)], 4, rope), rl)
    render(ell(0, 466, 14, 14), GOLD, img=img, sd=(3, 3), lw=1.4)
    paint(img, ell(0, 466, 6, 6), dk(hexc(GOLD), 0.6))
    return img

def dh_pants():
    m = U(yclip(torso_mask(9), 466, 612), legs(0, 0.84, lambda t: 10 + 30 * t * (1 - t) + 6 * t))
    img, line = render(m, "#2b2a33")
    for sx_ in (1, -1): paint(img, I(M(cloud(sx_ * 46, 690, 9), cloud(sx_ * 46 + 2, 692, 6)), m), hexc(GOLD))
    paint(img, I(legs(0.8, 0.84, 9), m), dk(hexc("#2b2a33"), 0.75))
    return img

def dh_boots():
    img = rgba_blank()
    m = U(legs(0.72, 1, 7), feet(8))
    _, l = render(m, "#24222a", img=img, sd=(4, 3))
    for sx_ in (1, -1):
        for tt in (0.82, 0.88, 0.94):
            x, y = leg_at(tt, sx_); y -= 6
            paint(img, lines([[(x - 12, y), (x + 12, y + 14)], [(x + 12, y), (x - 12, y + 14)]], 4, m), hexc("#c0282f"))
    paint(img, I(legs(0.72, 0.75, 8), m), hexc(GOLD))
    paint(img, I(M(m, shift(m, 0, -4)), rect(-300, 950, 300, 1000)), hexc("#8a7a5a"))
    return img

# ---------------------------------------------------------------- extras (phụ kiện / tạo hình)
def x_ngoc_quan():
    img = rgba_blank()
    render(lines([[(-44, 94), (44, 84)]], 5), GOLD, img=img, shade=0, lw=1)
    render(poly([(-26, 100), (26, 100), (24, 78), (12, 86), (0, 66), (-12, 86), (-24, 78)]), GOLD, img=img, sd=(4, 3))
    render(ell(0, 90, 6, 6), JADE, img=img, sd=(2, 2), lw=1)
    return img

def x_kep_toc():
    img = rgba_blank()
    render(poly([(-60, 128), (-48, 140), (-60, 152), (-72, 140)]), GOLD, img=img, sd=(2, 2))
    paint(img, ell(-60, 140, 3, 3), dk(hexc(GOLD), 0.55))
    tassel(-60, 152, 64, hexc("#c0282f"), img)
    return img

def x_khan_do():
    col = "#c8282f"
    wrap = poly(smooth([(-52, 284), (-30, 268), (0, 274), (30, 268), (52, 284), (58, 310), (30, 326), (0, 332), (-30, 326), (-58, 310)], 5))
    tail = poly(smooth([(-36, 298), (-110, 296), (-170, 330), (-196, 372), (-160, 366), (-120, 344), (-60, 330)], 5))
    hang = poly([(-30, 318), (-10, 320), (-20, 420), (-44, 414)])
    img, line = render(U(tail, hang), col, sd=(5, 3))
    render(wrap, col, img=img, sd=(6, 4))
    for c in [(-140, 334), (-100, 318)]: paint(img, I(M(rect(c[0] - 9, c[1] - 7, c[0] + 9, c[1] + 7), rect(c[0] - 5, c[1] - 3, c[0] + 5, c[1] + 3)), tail), hexc(GOLD))
    paint(img, I(key_band(-42, -10, 396, 408, 14), hang), hexc(GOLD))
    paint(img, lines([[(-40, 290), (40, 290)], [(-30, 312), (30, 316)]], 4, wrap), dk(hexc(col), 0.75))
    return img

def x_chuoi_co():
    img = rgba_blank()
    for k in range(13):
        t = k / 12; a = math.pi * (0.05 + 0.9 * t)
        x = -math.cos(a) * 44; y = 290 + math.sin(a) * 74
        render(ell(x, y, 6, 6), "#6b3a22", img=img, sd=(2, 2), lw=1)
    render(ell(0, 372, 10, 10), JADE, img=img, sd=(2, 2), lw=1.2)
    tassel(0, 382, 46, hexc("#c0282f"), img)
    return img

def x_chuoi_tay():
    img = rgba_blank()
    x, y = arm_at(0.92, -1)
    for k in range(-2, 3):
        render(ell(x + k * 7, y + abs(k) * 2, 6, 6), "#6b3a22", img=img, sd=(2, 2), lw=1)
    render(rect(x - 6, y + 14, x + 6, y + 40), JADE, img=img, sd=(2, 2), lw=1.2)
    paint(img, lines([[(x - 2, y + 20), (x + 2, y + 34)]], 3), dk(hexc(JADE), 0.6))
    return img

def x_ngoc_boi():
    img = rgba_blank()
    render(poly([(30, 482), (40, 494), (30, 506), (20, 494)]), "#c0282f", img=img, sd=(2, 2))
    render(ring(30, 524, 14, 7), JADE, img=img, sd=(3, 2), lw=1.4)
    tassel(30, 538, 66, hexc("#c0282f"), img)
    return img

def x_ho_lo():
    img = rgba_blank()
    render(ell(-104, 470, 16, 16), "#9a4a22", img=img, sd=(4, 3))
    render(ell(-110, 514, 24, 26), "#9a4a22", img=img, sd=(5, 4))
    render(rect(-110, 484, -98, 492), "#c0282f", img=img, shade=0, lw=1)
    render(rect(-108, 444, -100, 456), "#5a3a22", img=img, shade=0, lw=1)
    tassel(-92, 490, 50, hexc("#c0282f"), img)
    return img

def _hold_cut(img):
    img.paste((0, 0, 0, 0), (0, 0) + img.size, hands(0))
    return img

def weapon_grip():
    w = _m.POSE.get("weapon") or {}
    ang = math.radians(w.get("angle", 112)); side = w.get("side", -1)
    if w.get("both"):
        (x1, y1), (x2, y2) = hand_center(1), hand_center(-1); g = ((x1 + x2) / 2, (y1 + y2) / 2 - 6)
    else:
        g = hand_center(side)
    return g, (math.cos(ang) / _m.SQ(), math.sin(ang)), w.get("length", 240)

def x_kiem_ngoc():
    img = rgba_blank(); (gx, gy), (dx, dy), L = weapon_grip()
    p = lambda k: (gx + dx * k, gy + dy * k)
    render(lines([[p(16), p(L)]], 12), "#d4f2ea", img=img, line=hexc("#2a8f74"), sd=(2, 1))
    paint(img, lines([[p(24), p(L - 10)]], 3), WHITE)
    nx, ny = -dy, dx
    render(lines([[(p(14)[0] - nx * 18, p(14)[1] - ny * 18), (p(14)[0] + nx * 18, p(14)[1] + ny * 18)]], 8), GOLD, img=img, shade=0, lw=1.2)
    render(lines([[p(8), p(-30)]], 8), "#3b2418", img=img, shade=0, lw=1.2)
    px_, py_ = p(-34)
    render(ell(px_, py_, 6, 6), GOLD, img=img, shade=0, lw=1)
    tassel(px_, py_ + 6, 60, hexc("#c0282f"), img)
    return _hold_cut(img)

def x_kiem_bua():
    img = rgba_blank(); (gx, gy), (dx, dy), L = weapon_grip()
    p = lambda k: (gx + dx * k, gy + dy * k)
    render(lines([[p(12), p(L)]], 16), "#5a3a22", img=img, sd=(3, 2))
    for k in (0.28, 0.62, 0.95):
        q = p(12 + (L - 12) * k); nx, ny = -dy * 8, dx * 8
        render(lines([[(q[0] - nx, q[1] - ny), (q[0] + nx, q[1] + ny)]], 10), GOLD, img=img, shade=0, lw=1)
    render(lines([[p(6), p(-40)]], 10), "#2a2228", img=img, shade=0, lw=1.2)
    nx, ny = -dy, dx; q = p(10)
    render(lines([[(q[0] - nx * 15, q[1] - ny * 15), (q[0] + nx * 15, q[1] + ny * 15)]], 9), GOLD, img=img, shade=0, lw=1.2)
    tx, ty = p(L * 0.62)
    talis = poly([(tx - 10, ty), (tx + 10, ty), (tx + 14, ty + 130), (tx + 2, ty + 150), (tx - 8, ty + 130)])
    render(talis, "#e9e2a8", img=img, sd=(3, 2))
    paint(img, I(key_band(tx - 8, tx + 12, ty + 28, ty + 40, 12), talis), hexc(JADE))
    paint(img, I(key_band(tx - 6, tx + 14, ty + 80, ty + 92, 12), talis), hexc(JADE))
    return _hold_cut(img)

def x_kiem_deo():
    img = rgba_blank()
    render(lines([[(20, 520), (150, 700)]], 14), "#3b2418", img=img, sd=(4, 2))
    render(lines([[(20, 520), (-20, 468)]], 10), "#20232c", img=img, sd=(2, 2))
    render(lines([[(4, 520), (34, 500)]], 9), "#c9a24a", img=img, shade=0, lw=1.4)
    return img

def aura(c1, c2, seed=7):
    rnd = __import__("random").Random(seed)
    img = rgba_blank()
    base = U(torso_mask(30), legs(0, 1, 26), feet(24), arms(0.3, 1, 24))
    tongues = blank()
    for k in range(18):
        x = rnd.uniform(-130, 130); y = rnd.uniform(520, 960); w = rnd.uniform(12, 22)
        tongues = U(tongues, poly([(x - w, y), (x + w, y), (x + rnd.uniform(-30, 30), y - rnd.uniform(70, 170))]))
    outer = U(base, tongues)
    paint(img, outer, hexc(c1), 0.55)
    paint(img, erode(outer, 12), hexc(c1), 0.45)
    paint(img, erode(outer, 26), hexc(c2), 0.5)
    return img

def pet_fox(body_col, glow, mark):
    img = rgba_blank()
    tail = poly(smooth([(136, 214), (112, 196), (94, 160), (100, 120), (116, 140), (118, 176), (140, 196)], 5))
    bodym = ell(162, 212, 30, 18)
    head = ell(196, 186, 21, 18)
    ears = U(poly([(184, 174), (186, 146), (200, 168)]), poly([(200, 170), (214, 146), (214, 176)]))
    legs_ = U(ell(146, 230, 6, 9), ell(176, 232, 6, 9))
    m = U(tail, bodym, head, ears, legs_)
    paint(img, grow(m, 10), hexc(glow), 0.35)
    render(m, body_col, img=img, line=hexc(glow), shade=0.88, sd=(4, 3))
    paint(img, I(ell(104, 130, 10, 14), tail), WHITE)
    render(rect(186, 200, 210, 206), "#c0282f", img=img, shade=0, lw=1)
    render(ell(200, 212, 5, 5), GOLD, img=img, shade=0, lw=1)
    paint(img, rect(188, 182, 192, 188), hexc("#d48a1a")); paint(img, rect(204, 182, 208, 188), hexc("#d48a1a"))
    paint(img, poly([(196, 168), (199, 176), (193, 176)]), hexc(mark))
    return img

EXTRAS = [
    ("ngoc_quan", "hat", "Ngọc quan (vương miện búi tóc)", x_ngoc_quan, None),
    ("kep_toc", "hat", "Kẹp tóc kết vàng + tua đỏ", x_kep_toc, None),
    ("khan_do", "neck", "Khăn quàng đỏ", x_khan_do, None),
    ("chuoi_co", "neck", "Chuỗi hạt cổ", x_chuoi_co, None),
    ("ngoc_boi", "accessory", "Ngọc bội + tua đỏ", x_ngoc_boi, None),
    ("chuoi_tay", "accessory", "Chuỗi hạt cổ tay + bùa ngọc", x_chuoi_tay, None),
    ("ho_lo", "back", "Hồ lô rượu", x_ho_lo, None),
    ("kiem_ngoc", "weapon", "Ngọc kiếm (cầm tay)", x_kiem_ngoc, None),
    ("kiem_bua", "weapon", "Kiếm vỏ gỗ + bùa", x_kiem_bua, None),
    ("kiem_deo", "weapon", "Kiếm đeo hông", x_kiem_deo, None),
]

OUTFITS = [
    ("hiep_khach", "Hiệp khách", {"top": ("Áo trong màu kem", hk_inner), "outer": ("Áo bào + đai đỏ + kiếm", hk_robe),
                                  "bottom": ("Quần vải thụng", hk_pants),
                                  "shoes": ("Giày vải đế trắng", hk_shoes, 5),
                                  "hat": ("Nón tre", hk_hat), "back": ("Áo choàng rách", hk_cloak), "weapon": "kiem_deo"},
     {"hair": "co_trang_nam", "color": "den", "expression": "binh_thuong", "eyes": "den"}),
    ("tien_nu", "Tiên nữ", {"top": ("Áo giao lĩnh tay rộng", tn_top), "bottom": ("Váy dài xếp ly", tn_skirt),
                            "outer": ("Khăn choàng lụa", tn_ribbon), "shoes": ("Giày thêu", tn_shoes, -5),
                            "hat": ("Trâm bộ diêu", tn_pin), "accessory": "ngoc_boi"},
     {"hair": "co_trang_nu", "color": "den", "expression": "cuoi", "eyes": "nau"}),
    ("tuong_quan", "Tướng quân", {"top": ("Chiến bào đỏ", tq_under), "outer": ("Giáp vảy cá", tq_armor),
                                  "bottom": ("Quần chiến", lambda: bottom_pants("#3a2f2a")),
                                  "shoes": ("Chiến hài", lambda: boots("#2a2220", "#d9b24a", 0.6), 5),
                                  "hat": ("Mũ trụ", tq_helmet), "back": ("Áo choàng tướng", tq_cape)},
     {"hair": "bui", "color": "den", "expression": "gian", "eyes": "den"}),
    ("quan_van", "Quan văn", {"top": ("Áo trong trắng", plain("#efece4")), "outer": ("Áo bào bổ tử", qv_robe),
                              "bottom": ("Quần trắng", lambda: bottom_pants("#e9e4d6")),
                              "shoes": ("Hia đen", lambda: boots("#1d1b22", "#f0f0f0", 0.8), 5),
                              "hat": ("Mũ cánh chuồn", qv_hat)},
     {"hair": "co_trang_nam", "color": "bac", "expression": "lanh_lung", "eyes": "den"}),
    ("tu_than", "Tứ thân", {"top": ("Yếm đỏ", tt_yem), "outer": ("Áo tứ thân + thắt lưng bao", tt_ao),
                            "bottom": ("Váy đụp đen", tt_skirt), "shoes": ("Dép cong", tt_shoes, -5),
                            "hat": ("Nón quai thao", tt_hat)},
     {"hair": "co_trang_nu", "color": "nau", "expression": "cuoi", "eyes": "den"}),
    ("thich_khach", "Thích khách", {"top": ("Dạ hành y", tk_suit), "outer": ("Bao tay + đai phi đao", tk_gear),
                                    "bottom": ("Quần bó + xà cạp", tk_pants),
                                    "shoes": ("Giày mềm", lambda: boots("#1b1620", None, 0.85), 5),
                                    "hat": ("Khăn che mặt", tk_mask), "weapon": "kiem_deo"},
     {"hair": "duoi_ngua", "color": "lam", "expression": "lanh_lung", "eyes": "do"}),
    ("kiem_tien", "Kiếm tiên thanh y", {"top": ("Áo trong kem", plain("#ece6d6", 0.42)), "outer": ("Thanh bào viền vàng", kt_robe),
                                       "bottom": ("Quần lụa trắng", kt_pants), "shoes": ("Giày vải đế trắng", hk_shoes, 5),
                                       "back": ("Dải lụa đỏ", kt_ribbons), "hat": "ngoc_quan", "accessory": "ngoc_boi", "weapon": "kiem_ngoc"},
     {"hair": "kiem_tien", "color": "den", "expression": "lanh_lung", "eyes": "nau"}),
    ("du_hiep", "Thiếu niên du hiệp", {"top": ("Áo dài kem hoa văn", dh_tunic), "outer": ("Áo khoác lam viền vàng + đai thừng", dh_jacket),
                                       "bottom": ("Quần thụng mây vàng", dh_pants), "shoes": ("Ủng buộc dây đỏ", dh_boots, 5),
                                       "neck": "khan_do", "hat": "kep_toc", "accessory": "chuoi_tay", "weapon": "kiem_bua", "back": "ho_lo"},
     {"hair": "thieu_nien", "color": "lam", "expression": "tu_tin", "eyes": "nau"}),
]
