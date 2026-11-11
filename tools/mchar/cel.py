"""Anime cel-shaded restyle of the modular cổ trang renderer.
import cel; cel.enable(SS) BEFORE rendering: masks are drawn SS x larger (smooth edges), render() paints
a coloured line art, a hard cool shadow tone and a thin lit rim; cel.down(img) brings layers back to 1x."""
from PIL import Image, ImageFilter
import modular as m
SS = [1]
_orig_render = m.render
def _shadow(fill):
    d = m.dk(fill, 0.80)
    return m.mix(d, (88, 60, 140, 255), 0.18)          # cool, slightly violet anime shadow
def render(mask, fill, line=None, lw=2.0, shade=0.8, sd=(9, 6), seams=(), img=None):
    fill = m.hexc(fill) if isinstance(fill, str) else fill
    line = line or m.mix(m.dk(fill, 0.32), (36, 20, 44, 255), 0.45)
    img = img or m.rgba_blank()
    lw_eff = max(lw, 4.4)                                # ~1.1 px line at final size
    m.paint(img, m.grow(mask, lw_eff), line)
    m.paint(img, mask, fill)
    if shade:
        sh = m.M(mask, m.shift(mask, -sd[0] * 1.15, -sd[1] * 1.15))
        m.paint(img, sh, _shadow(fill) if shade >= 0.7 else m.dk(fill, shade))
        rim = m.M(mask, m.shift(mask, sd[0] * 0.45, sd[1] * 0.45))
        m.paint(img, m.M(rim, sh), m.mix(fill, (255, 250, 240, 255), 0.22))
    for s_ in seams: m.paint(img, s_, line)
    return img, line
def enable(ss=2):
    SS[0] = ss
    m.PIX = 4 / ss; m.S = 1 / m.PIX
    m.render = render
    import ancient; ancient.render = render
    for mod in list(__import__('sys').modules.values()):
        if mod is not None and getattr(mod, 'render', None) is _orig_render and mod is not m: mod.render = render
def down(img, k=1):
    if img is None or SS[0] == k: return img
    w, h = img.size
    r = img.resize((w * k // SS[0], h * k // SS[0]), Image.LANCZOS)
    return r

def _eye_open(img, cx, cy, iris, s, gender, lid=0, small=False, big=False, slant=None):
    """anime eye: almond white, tall gradient iris, pupil, two catch-lights, thick curved upper lash"""
    h = (14 if big else 12) if gender == "nu" else (13 if big else 10)
    k = m.EYE_K[0]
    xi, xo = cx - 11 * k * s, cx + 11 * k * s
    if slant is None: slant = (-h + lid, -h + lid)
    yi, yo = cy + slant[0], cy + slant[1]
    below = m.poly([(xi, yi), (xo, yo), (xo, cy + 40), (xi, cy + 40)])
    white = m.I(m.ell(cx, cy + 1, 11 * k, h), below)
    m.paint(img, white, (252, 250, 246, 255))
    ir = (5 if small else 8.5) * (0.8 if k < 1 else 1)
    ic = cx + m.IRIS_DX[0]
    irm = m.I(m.ell(ic, cy + 1, ir, h - (4 if small else 1)), white)
    m.paint(img, irm, m.dk(iris, 0.62))
    m.paint(img, m.I(m.ell(ic, cy + h * 0.45, ir * 0.9, h * 0.62), irm), iris)
    m.paint(img, m.I(m.ell(ic, cy + h * 0.72, ir * 0.7, h * 0.32), irm), m.mix(iris, m.WHITE, 0.45))
    m.paint(img, m.I(m.ell(ic, cy + 1, ir * 0.42, h * 0.45), irm), m.mix(m.dk(iris, 0.25), (20, 10, 20, 255), 0.5))
    if not small:
        m.paint(img, m.I(m.ell(ic - ir * 0.38 * s, cy - h * 0.38, 3.2, 3.6), white), m.WHITE)
        m.paint(img, m.I(m.ell(ic + ir * 0.4 * s, cy + h * 0.45, 1.6, 1.6), white), m.WHITE)
    mid = ((xi + xo) / 2, min(yi, yo) - 3)
    m.paint(img, m.lines([m.smooth([(xi - 2 * s, yi + 2), mid, (xo + 3 * s, yo)], 6)], 6.2), m.INK)
    if gender == "nu":
        m.paint(img, m.poly([(xo, yo - 1), (xo + 8 * s, yo - 7), (xo + 5 * s, yo + 4)]), m.INK)
    m.paint(img, m.lines([[(cx - 7 * k, cy + h + 1), (cx + 7 * k, cy + h + 1)]], 1.6), m.mix(m.INK, (200, 150, 140, 255), 0.45))
_orig_enable = enable
def enable(ss=2):
    _orig_enable(ss); m._eye_open = _eye_open
