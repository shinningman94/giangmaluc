"""Compose characters from v3 sheets (same rules as the Unity script and the web preview)."""
import json, os
from PIL import Image

class Rig:
    def __init__(self, od):
        self.od = od
        self.man = json.load(open(os.path.join(od, "manifest.json"), encoding="utf-8"))
        self.by = {p["id"]: p for p in self.man["parts"]}
        self.fw, self.fh = self.man["frame"]["w"], self.man["frame"]["h"]
        self.cols = self.man["sheet"]["cols"]
        self._img = {}

    def resolve(self, base, g):
        return self.by.get(f"{base}__{g}") or self.by.get(base)

    def look(self, gender="nam", skin="sang", outfit=None, **over):
        L = {"hair": "kiem_tien", "color": "den", "expression": "binh_thuong", "eyes": "nau", "aura": None, "pet": None, "fx": True}
        slots = {}
        if outfit:
            st = next(s for s in self.man["outfitSets"] if s["id"] == outfit)
            L.update({k: v for k, v in (st.get("suggest") or {}).items()}); slots.update(st["parts"])
        L.update(over)
        for k in ("aura", "pet"):
            if L.get(k): slots[k] = L[k]
        L["slots"] = slots; L["gender"] = gender; L["skin"] = skin
        return L

    def parts(self, L, frame):
        fmeta = self.man["frames"][frame]
        expr = fmeta.get("face") or L["expression"]
        bases = [f"body_{L['skin']}", f"face_{expr}_{L['eyes']}"]
        if L.get("hair"): bases += [f"hair_{L['hair']}_{L['color']}_front", f"hair_{L['hair']}_{L['color']}_back"]
        bases += list(L["slots"].values())
        if L.get("fx"): bases.append("fx_hieu_ung")
        out, seen = [], set()
        def add(b):
            p = self.resolve(b, L["gender"])
            if not p or p["id"] in seen: return
            seen.add(p["id"]); out.append(p)
            for ln in p.get("links") or []: add(ln)
        for b in bases: add(b)
        return sorted(out, key=lambda p: (p["sortingLayerIndex"], p["orderInLayer"]))

    def sheet(self, p):
        if p["file"] not in self._img:
            self._img[p["file"]] = Image.open(os.path.join(self.od, p["file"])).convert("RGBA")
        return self._img[p["file"]]

    def frame(self, L, frame):
        c = Image.new("RGBA", (self.fw, self.fh), (0, 0, 0, 0))
        x, y = (frame % self.cols) * self.fw, (frame // self.cols) * self.fh
        for p in self.parts(L, frame):
            c.alpha_composite(self.sheet(p).crop((x, y, x + self.fw, y + self.fh)))
        return c
