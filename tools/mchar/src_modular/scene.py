"""Hoạt cảnh: a short pixel-art scene played by two modular characters. Writes GIF + MP4.

python3 scene.py <sheets_dir> <out_basename>
"""
import math, random, subprocess, sys
from PIL import Image, ImageDraw
from compose3 import Rig

SW, SH, GROUND, SCALE, FPS = 480, 270, 260, 2, 10

def background():
    rnd = random.Random(3)
    bg = Image.new("RGBA", (SW, SH)); d = ImageDraw.Draw(bg)
    bands = [(16, 18, 40), (24, 24, 56), (36, 30, 72), (56, 38, 84), (84, 48, 88)]
    bh = 150 // len(bands)
    for i, c in enumerate(bands):
        d.rectangle([0, i * bh, SW, (i + 1) * bh], fill=c)
        if i + 1 < len(bands):
            for y in range((i + 1) * bh - 4, (i + 1) * bh):
                for x in range((y % 2), SW, 2): d.point((x, y), fill=bands[i + 1])
    d.rectangle([0, 150, SW, SH], fill=bands[-1])
    for _ in range(90): d.point((rnd.randrange(SW), rnd.randrange(120)), fill=(220, 220, 250))
    d.ellipse([376, 26, 420, 70], fill=(246, 236, 206)); d.ellipse([388, 36, 396, 44], fill=(226, 214, 186)); d.ellipse([402, 50, 412, 60], fill=(226, 214, 186))
    def ridge(base, amp, col, seed):
        r = random.Random(seed); pts = [(0, SH)]; x = 0; y = base
        while x <= SW:
            pts.append((x, y)); x += r.randint(14, 30); y = base - r.randint(0, amp)
        pts += [(SW, SH)]; d.polygon(pts, fill=col)
    ridge(150, 60, (44, 34, 70), 5); ridge(178, 40, (32, 28, 52), 9)
    # temple gate (tam quan)
    gx, gy = 240, 120
    roof = (34, 22, 30); red = (128, 34, 40); gold = (214, 168, 70)
    for x in (gx - 70, gx - 28, gx + 24, gx + 66):
        d.rectangle([x, gy + 30, x + 6, GROUND - 22], fill=red); d.rectangle([x + 4, gy + 30, x + 6, GROUND - 22], fill=(96, 24, 30))
    d.rectangle([gx - 82, gy + 22, gx + 84, gy + 32], fill=red); d.rectangle([gx - 20, gy + 36, gx + 22, gy + 50], fill=gold)
    d.rectangle([gx - 16, gy + 39, gx + 18, gy + 47], fill=(60, 30, 26))
    d.polygon([(gx - 104, gy + 24), (gx - 88, gy + 10), (gx + 90, gy + 10), (gx + 106, gy + 24), (gx + 96, gy + 18), (gx - 94, gy + 18)], fill=roof)
    d.polygon([(gx - 60, gy + 8), (gx - 48, gy - 6), (gx + 50, gy - 6), (gx + 62, gy + 8)], fill=roof)
    d.line([(gx - 104, gy + 24), (gx - 110, gy + 16)], fill=roof, width=3); d.line([(gx + 106, gy + 24), (gx + 112, gy + 16)], fill=roof, width=3)
    # ground: stone floor with tile lines
    d.rectangle([0, GROUND - 22, SW, SH], fill=(74, 66, 78))
    for y in range(GROUND - 22, SH, 8): d.line([(0, y), (SW, y)], fill=(62, 54, 66))
    for y in range(GROUND - 22, SH, 8):
        off = 0 if (y // 8) % 2 else 12
        for x in range(off, SW, 24): d.line([(x, y), (x, y + 7)], fill=(62, 54, 66))
    # lanterns
    for x in (34, SW - 40):
        d.rectangle([x + 4, GROUND - 92, x + 6, GROUND - 22], fill=(40, 30, 34))
        d.ellipse([x - 6, GROUND - 112, x + 16, GROUND - 90], fill=(206, 54, 46)); d.rectangle([x - 2, GROUND - 106, x + 12, GROUND - 96], fill=(246, 150, 70))
    return bg

def lantern_glow(img, t):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for x in (39, SW - 35):
        a = 34 + int(12 * math.sin(t * 0.7 + x))
        for r, k in ((26, 0.5), (18, 0.8)):
            d.ellipse([x - r, GROUND - 101 - r, x + r, GROUND - 101 + r], fill=(255, 150, 70, int(a * k)))
    img.alpha_composite(ov)

def petals(img, t):
    d = ImageDraw.Draw(img)
    rnd = random.Random(1)
    for k in range(18):
        x0, sp, ph = rnd.uniform(0, SW), rnd.uniform(0.6, 1.4), rnd.uniform(0, 6)
        y = (t * 2.2 * sp + k * 37) % (SH + 20) - 10; x = (x0 - t * 1.6 * sp + 8 * math.sin(t * 0.2 + ph)) % SW
        d.rectangle([x, y, x + 1, y + 1], fill=(246, 178, 196))

def anim_frame(rig, anim, t):
    a = next(a for a in rig.man["animations"] if a["id"] == anim)
    k = int(t * a["fps"] / FPS)
    fr = a["frames"]
    return fr[k % len(fr)] if a["loop"] else fr[min(k, len(fr) - 1)]

def main(od, outbase):
    rig = Rig(od)
    hero = rig.look("nam", "sang", "kiem_tien", aura=None)
    foe = rig.look("nu", "ngam", "thich_khach")
    bg = background()
    # timeline: (start, end, hero action, hero x0, x1, foe action, foe x0, x1)
    T = [(0, 22, ("walk",), -60, 130, ("idle",), 300, 300),
         (22, 32, ("pose", 5), 130, 130, ("pose", 5), 300, 300),
         (32, 40, ("pose", 1), 130, 130, ("pose", 1), 300, 300),
         (40, 48, ("attack",), 130, 170, ("hurt_at", 2), 300, 330),
         (48, 54, ("pose", 1), 170, 170, ("pose", 1), 330, 330),
         (54, 66, ("cast",), 170, 170, ("hurt_at", 5), 330, 380),
         (66, 90, ("victory",), 170, 170, ("gone",), 380, 380)]
    frames = []
    for gt in range(90):
        seg = next(s for s in T if s[0] <= gt < s[1])
        st, en, hact, hx0, hx1, fact, fx0, fx1 = seg
        u = (gt - st) / max(1, en - st - 1); lt = gt - st
        img = bg.copy(); lantern_glow(img, gt)
        # hero
        H = dict(hero)
        if hact[0] == "pose": hf = rig.man["poses"][hact[1]]["frame"]
        else: hf = anim_frame(rig, hact[0], lt)
        hx = hx0 + (hx1 - hx0) * u
        # foe
        F = dict(foe); ff = None
        if fact[0] == "idle": ff = anim_frame(rig, "idle", lt)
        elif fact[0] == "pose": ff = rig.man["poses"][fact[1]]["frame"]
        elif fact[0] == "hurt_at":
            ff = anim_frame(rig, "hurt", lt - fact[1]) if lt >= fact[1] else rig.man["poses"][1]["frame"]
        fxp = fx0 + (fx1 - fx0) * (max(0, lt - (fact[1] if fact[0] == "hurt_at" else 0)) / max(1, en - st - 1))
        if ff is not None:
            fimg = rig.frame(F, ff).transpose(Image.FLIP_LEFT_RIGHT)
            img.alpha_composite(fimg, (int(fxp) - 64, GROUND - 244))
        himg = rig.frame(H, hf)
        img.alpha_composite(himg, (int(hx) - 64, GROUND - 244))
        petals(img, gt)
        frames.append(img.convert("RGB").resize((SW * SCALE, SH * SCALE), Image.NEAREST))
    frames[0].save(outbase + ".gif", save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0, optimize=True)
    tmp = outbase + "_frames"
    import os; os.makedirs(tmp, exist_ok=True)
    for i, f in enumerate(frames): f.save(f"{tmp}/{i:03d}.png")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{tmp}/%03d.png", "-c:v", "libx264",
                    "-preset", "veryfast", "-pix_fmt", "yuv420p", "-vf", "scale=iw:ih:flags=neighbor", outbase + ".mp4"], check=False)
    subprocess.run(["rm", "-rf", tmp])
    print("scene ok", len(frames))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
