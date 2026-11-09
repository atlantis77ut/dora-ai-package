# -*- coding: utf-8 -*-
"""dashboard/data.json -> dashboard/dashboard.png (Pillow ile, tarayıcısız)."""
import io
import json
import os

from PIL import Image, ImageDraw, ImageFont

REPO = r"C:\Users\Ugurt\Documents\deepseek-harness\default-workspace\dora-ai-package"
DATA = os.path.join(REPO, "dashboard", "data.json")
OUT = os.path.join(REPO, "dashboard", "dashboard.png")

BG = (11, 16, 32)
PANEL = (19, 26, 46)
LINE = (36, 48, 77)
FG = (232, 237, 247)
MUTED = (147, 161, 192)
OK = (52, 211, 153)
WARN = (251, 191, 36)
BAD = (248, 113, 113)
ACCENT = (96, 165, 250)
ACCENT2 = (167, 139, 250)

FONTS = {
    "r": r"C:\Windows\Fonts\segoeui.ttf",
    "b": r"C:\Windows\Fonts\segoeuib.ttf",
    "m": r"C:\Windows\Fonts\consola.ttf",
}


def font(kind, size):
    path = FONTS.get(kind, FONTS["r"])
    if not os.path.exists(path):
        path = FONTS["r"]
    return ImageFont.truetype(path, size)


d = json.load(io.open(DATA, encoding="utf-8"))
W, H = 1220, 950
img = Image.new("RGB", (W, H), BG)
dr = ImageDraw.Draw(img)

# arka plan ışıması
for i in range(220, 0, -1):
    a = i / 220
    dr.ellipse([W * 0.05 - i * 3, -i * 2.2, W * 0.05 + i * 3, -i * 2.2 + i * 2], fill=(int(15 + 18 * a), int(22 + 20 * a), int(44 + 24 * a)))

M = 40  # margin


def text(xy, s, f, fill=FG):
    dr.text(xy, s, font=f, fill=fill)


def panel(box, radius=14, fill=PANEL, outline=LINE):
    dr.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=1)


y = 34
text((M, y), d["package"]["name"], font("b", 26))
y += 36
sub = f"v{d['package']['version']} · {d['package']['license']} · {len(d['phases'])} ORL fazı"
text((M, y), sub, font("r", 12.5), MUTED)
health_txt = "sağlık: temiz" if d["health"]["ok"] else f"sağlık: {len(d['health']['issues'])} sorun"
dr.text((W - M - dr.textlength(health_txt, font=font("r", 12.5)), y), health_txt, font=font("r", 12.5),
        fill=OK if d["health"]["ok"] else BAD)

# ── KPI kartları ──────────────────────────────────────────
k = d["kpis"]
cards = [
    ("SÜREÇ", k["processes"], "5 sütun"),
    ("KONTROL", k["controls"], " · ".join(f"{a} {b}" for a, b in d["control_families"].items())),
    ("AJAN", k["roles"], f"{k['orCodes']} ORL kodu"),
    ("TERİM", k["terms"], "DORA + RTS/ITS"),
    ("SENARYO", k["scenarios"], f"{k['assertions']} assertion"),
    ("KAPSAMA", f"{k['coverage']}%", f"{d['coverage']['covered']}/{d['coverage']['total']} madde"),
]
top = 108
gap = 12
cw = (W - 2 * M - 5 * gap) / 6
for i, (label, val, hint) in enumerate(cards):
    x0 = M + i * (cw + gap)
    box = [x0, top, x0 + cw, top + 92]
    panel(box)
    text((x0 + 16, top + 14), label, font("r", 9.5), MUTED)
    text((x0 + 16, top + 32), str(val), font("b", 25))
    text((x0 + 16, top + 66), hint, font("r", 9), MUTED)

# ── kapsama paneli ────────────────────────────────────────
cy = top + 112
panel([M, cy, W - M, cy + 96])
text((M + 18, cy + 14), "DORA KAPSAMA", font("r", 10), MUTED)
text((M + 18 + 118, cy + 14), "madde bazında", font("r", 10), (110, 124, 158))

bar_x, bar_y, bar_w, bar_h = M + 18, cy + 40, W - 2 * M - 36, 12
total = max(d["coverage"]["total"], 1)
seg = [
    (d["coverage"]["covered"], OK),
    (d["coverage"]["partial"], WARN),
    (d["coverage"]["gap"], BAD),
]
dr.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], radius=6, fill=(25, 33, 55))
cur = bar_x
for n, col in seg:
    w = bar_w * n / total
    if w > 0:
        dr.rounded_rectangle([cur, bar_y, cur + w, bar_y + bar_h], radius=0, fill=col)
        cur += w

lx = bar_x
for label, n, col in [
    ("kapsandı", d["coverage"]["covered"], OK),
    ("kısmi", d["coverage"]["partial"], WARN),
    ("boşluk", d["coverage"]["gap"], BAD),
]:
    dr.ellipse([lx, cy + 66, lx + 8, cy + 74], fill=col)
    s = f"{n} {label}"
    text((lx + 14, cy + 62), s, font("r", 11), MUTED)
    lx += 14 + dr.textlength(s, font=font("r", 11)) + 22
s = f"toplam {d['coverage']['total']} madde"
text((bar_x + bar_w - dr.textlength(s, font=font("r", 11)), cy + 62), s, font("r", 11), MUTED)

# ── fazlar ────────────────────────────────────────────────
py = cy + 112
panel([M, py, W - M, py + 236])
text((M + 18, py + 14), "ORL UYGULAMA FAZLARI", font("r", 10), MUTED)
text((M + 18 + 190, py + 14), "geçiş kapıları", font("r", 10), (110, 124, 158))

cols = [("FAZ", 0, 52), ("ADIM", 52, 430), ("ORL", 482, 110), ("ADIM#", 592, 62)]
x_hdr = [M + 18, M + 18 + 52, M + 18 + 482, M + 18 + 592]
hy = py + 40
for (label, _off, _w) in cols:
    pass
for label, off in [("FAZ", 0), ("ADIM", 52), ("ORL", 482), ("ADIM#", 592)]:
    text((M + 18 + off, hy), label, font("r", 9), MUTED)
text((M + 18 + 668, hy), "KAPI", font("r", 9), MUTED)
text((M + 18 + 736, hy), "GÜN", font("r", 9), MUTED)
text((M + 18 + 792, hy), "AJAN MODU", font("r", 9), MUTED)

ry = hy + 20
for p in d["phases"]:
    dr.line([M + 18, ry - 4, W - M - 18, ry - 4], fill=(30, 40, 64), width=1)
    text((M + 18, ry + 2), p["id"], font("m", 12), ACCENT)
    name = p["name"]
    name = name.split("—")[-1].strip() if "—" in name else name
    if len(name) > 52:
        name = name[:51] + "…"
    text((M + 18 + 52, ry + 2), name, font("r", 12), FG)
    text((M + 18 + 482, ry + 2), p["orl"], font("r", 11.5), MUTED)
    text((M + 18 + 600, ry + 2), str(p["steps"]), font("r", 11.5), FG)
    text((M + 18 + 676, ry + 2), str(p["gates"]), font("r", 11.5), FG)
    text((M + 18 + 744, ry + 2), str(p["days"]), font("r", 11.5), FG)
    lvl = p["level"].replace("_", " ")
    dr.rounded_rectangle([M + 18 + 806, ry - 1, M + 18 + 806 + dr.textlength(lvl, font=font("r", 10)) + 16, ry + 17],
                         radius=9, outline=LINE, fill=(20, 27, 47))
    text((M + 18 + 814, ry + 1), lvl, font("r", 10), ACCENT2)
    ry += 32

# ── iki sütun: açık noktalar + senaryolar ─────────────────
ty = py + 252
left_w = 560
panel([M, ty, M + left_w, ty + 214])
text((M + 18, ty + 14), "AÇIK NOKTALAR", font("r", 10), MUTED)
text((M + 18 + 128, ty + 14), "kapatılmadan C5 geçmez", font("r", 10), (110, 124, 158))

ly = ty + 42
gaps = [g for g in d["gaps"] if g.get("status") == "gap"]
partials = [g for g in d["gaps"] if g.get("status") == "partial"]
for g in gaps:
    text((M + 18, ly), g["id"], font("m", 11.5), BAD)
    t = g["title"]
    text((M + 84, ly), t[:52] + ("…" if len(t) > 52 else ""), font("r", 11.5), FG)
    pill = "boşluk"
    dr.rounded_rectangle([M + 84 + 300, ly - 1, M + 84 + 300 + dr.textlength(pill, font=font("r", 9.5)) + 14, ly + 16],
                         radius=8, outline=(91, 38, 38), fill=(44, 22, 22))
    text((M + 84 + 307, ly), pill, font("r", 9.5), BAD)
    ly += 24
for p in partials:
    text((M + 18, ly), p["id"], font("m", 11.5), WARN)
    t = p["title"]
    text((M + 84, ly), t[:46] + ("…" if len(t) > 46 else ""), font("r", 11.5), MUTED)
    pill = "kısmi"
    dr.rounded_rectangle([M + 84 + 300, ly - 1, M + 84 + 300 + dr.textlength(pill, font=font("r", 9.5)) + 14, ly + 16],
                         radius=8, outline=LINE, fill=(20, 27, 47))
    text((M + 84 + 307, ly), pill, font("r", 9.5), WARN)
    ly += 24

rx = M + left_w + 16
panel([rx, ty, W - M, ty + 214])
text((rx + 18, ty + 14), "KABUL SENARYOLARI", font("r", 10), MUTED)
sy = ty + 42
for s in d["scenarios"]:
    text((rx + 18, sy), s["id"], font("m", 11.5), ACCENT)
    nm = (s.get("name") or "")[:46]
    nm = nm + ("…" if len((s.get("name") or "")) > 46 else "")
    text((rx + 78, sy), nm, font("r", 11), FG)
    a = str(s.get("assertions") or "")
    text((W - M - 34 - dr.textlength(a, font=font("b", 11)), sy), a, font("b", 11), OK)
    sy += 26
text((rx + 18, ty + 180), "her senaryoda tuzak testleri var", font("r", 9.5), MUTED)

# ── sağlık şeridi ─────────────────────────────────────────
hy2 = ty + 230
panel([M, hy2, W - M, hy2 + 62], fill=(17, 24, 42))
col = OK if d["health"]["ok"] else BAD
bx, by = M + 18, hy2 + 18
dr.rounded_rectangle([bx, by, bx + 22, by + 22], radius=6, fill=(20, 40, 36) if d["health"]["ok"] else (44, 22, 22), outline=col, width=1)
if d["health"]["ok"]:
    dr.line([bx + 5, by + 12, bx + 9, by + 16], fill=col, width=2)
    dr.line([bx + 9, by + 16, bx + 17, by + 6], fill=col, width=2)
else:
    dr.line([bx + 6, by + 6, bx + 16, by + 16], fill=col, width=2)
    dr.line([bx + 16, by + 6, bx + 6, by + 16], fill=col, width=2)
msg = ("Sarkan referans yok — süreç, kontrol, senaryo ve DORA eşlemesi birbirini çözüyor."
       if d["health"]["ok"] else f"{len(d['health']['issues'])} sarkan referans var")
text((M + 46, hy2 + 20), msg, font("r", 11.5), FG)
text((M + 46, hy2 + 38), "doğrulama: render-mapping --check · validate_controls · validate_scenarios", font("r", 9.5), MUTED)

text((M, H - 34), "Bu görsel depodaki YAML dosyalarından üretildi · node docs/tools/build-dashboard.mjs",
     font("r", 10), (110, 124, 158))

img.save(OUT)
print("yazıldı:", OUT, img.size)
