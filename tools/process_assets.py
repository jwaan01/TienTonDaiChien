#!/usr/bin/env python3
"""Turn the ChatGPT sprite sheets in raw/ into game-ready atlases in game/assets/.

Each sheet is 7 rows (4/6/6/6/6/6/6 frames) on a near-magenta background that
is not one exact colour, so the key works in three steps:
  1. mark "magenta-like" pixels with a loose test,
  2. keep only the magenta-like pixels connected to the image border (so purple
     clothing inside a character survives),
  3. feather the edge and remove magenta spill from the outline.
Rows are found at occupancy minima near the 7 expected bands; frames inside a
row are split at the widest empty column gaps. A debug contact sheet per
character is written to tools/debug/ so every cut can be checked by eye.

Usage: python3 tools/process_assets.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
OUT = ROOT / "docs" / "assets"
DEBUG = ROOT / "tools" / "debug"

ROWS = [  # (row name, expected frame count)
    ("idle", 4), ("run", 6), ("move", 6), ("combo", 6),
    ("special", 6), ("ultimate", 6), ("damage", 6),
]
TARGET_HEIGHT = 150  # idle height in game pixels (canvas is 960x540)

CHARACTERS = [
    "phuong-nguyen", "hong-lien-ma-ton", "nguyen-lien-tien-ton", "tinh-tu-tien-ton",
    "lac-tho-tien-ton", "cu-duong-tien-ton", "dao-thien-ma-ton", "u-hon-ma-ton",
    "u-hon-ma-ton_hon-the", "cuong-man-ma-ton", "vo-cuc-ma-ton", "nguyen-thuy-tien-ton",
]


# --------------------------------------------------------------------------- key
def magenta_like(rgb):
    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    return (r > 150) & (b > 150) & (g < 140) & ((np.minimum(r, b) - g) > 70)


def border_connected(mask):
    """Flood fill from the image border through `mask` (no scipy needed)."""
    fill = np.zeros_like(mask)
    fill[0, :] = mask[0, :]
    fill[-1, :] = mask[-1, :]
    fill[:, 0] |= mask[:, 0]
    fill[:, -1] |= mask[:, -1]
    while True:
        grown = fill.copy()
        grown[1:, :] |= fill[:-1, :]
        grown[:-1, :] |= fill[1:, :]
        grown[:, 1:] |= fill[:, :-1]
        grown[:, :-1] |= fill[:, 1:]
        grown &= mask
        if (grown == fill).all():
            return fill
        # jump ahead: many iterations are cheap, but cap the loop work
        fill = grown


def key_sheet(img):
    rgb = np.asarray(img.convert("RGB"))
    bg = border_connected(magenta_like(rgb))
    # also drop enclosed pure-magenta pockets (gaps between arms, under robes)
    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    strong = (r > 190) & (b > 190) & (g < 90)
    bg |= strong
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # feather: a pixel next to background gets partial alpha by magenta amount
    edge = np.zeros_like(bg)
    edge[1:, :] |= bg[:-1, :]
    edge[:-1, :] |= bg[1:, :]
    edge[:, 1:] |= bg[:, :-1]
    edge[:, :-1] |= bg[:, 1:]
    edge &= ~bg
    mag = np.clip((np.minimum(r, b) - g - 20) / 120.0, 0, 1)
    alpha = np.where(edge, (255 * (1 - mag * 0.85)).astype(np.uint8), alpha)
    # despill on the 2px rim next to the background: remove the magenta cast
    rim = edge.copy()
    rim[1:, :] |= edge[:-1, :]
    rim[:-1, :] |= edge[1:, :]
    rim[:, 1:] |= edge[:, :-1]
    rim[:, :-1] |= edge[:, 1:]
    rim &= ~bg
    excess = np.clip(np.minimum(r, b) - g, 0, None)
    out = rgb.astype(np.int16).copy()
    fix = rim & (excess > 25)
    out[..., 0] = np.where(fix, r - (excess * 0.8).astype(np.int16), r)
    out[..., 2] = np.where(fix, b - (excess * 0.8).astype(np.int16), b)
    rgba = np.dstack([np.clip(out, 0, 255).astype(np.uint8), alpha])
    return rgba


# --------------------------------------------------------------------- slicing
def find_rows(alpha, n):
    h = alpha.shape[0]
    occ = (alpha > 40).sum(axis=1).astype(float)
    k = np.ones(9) / 9
    occ = np.convolve(occ, k, mode="same")
    cuts = [0]
    for i in range(1, n):
        c = int(i * h / n)
        w = int(h / n * 0.35)
        seg = occ[c - w:c + w]
        cuts.append(c - w + int(np.argmin(seg)))
    cuts.append(h)
    return list(zip(cuts[:-1], cuts[1:]))


def find_frames(band_alpha, n, x_grid):
    w = band_alpha.shape[1]
    occ = (band_alpha > 40).sum(axis=0)
    empty = occ <= 1
    gaps, x = [], 0
    while x < w:
        if empty[x]:
            s = x
            while x < w and empty[x]:
                x += 1
            if s > 0 and x < w:
                gaps.append((x - s, s, x))
        else:
            x += 1
    gaps.sort(reverse=True)
    if len(gaps) >= n - 1:
        cuts = sorted((s + e) // 2 for _, s, e in gaps[:n - 1])
        bounds = [0] + cuts + [w]
        segs = list(zip(bounds[:-1], bounds[1:]))
        mass = [occ[a:b].sum() for a, b in segs]
        # a real frame split: every piece holds a character-sized mass and no
        # piece spans much more than one grid cell (+ its empty margin)
        ok = min(mass) > 0.04 * sum(mass) and all(
            (np.ptp(np.nonzero(occ[a:b] > 1)[0]) if (occ[a:b] > 1).any() else 0) < 1.45 * x_grid
            for a, b in segs)
        if ok:
            return segs, "gaps"
    # fallback: regular grid, each cut moved to the emptiest column nearby
    smooth = np.convolve(occ.astype(float), np.ones(7) / 7, mode="same")
    cuts = []
    for i in range(1, n):
        c = int(i * x_grid)
        lo, hi = max(1, c - 48), min(w - 1, c + 48)
        cuts.append(lo + int(np.argmin(smooth[lo:hi])))
    bounds = [0] + cuts + [int(min(w, n * x_grid + x_grid * 0.5))]
    return list(zip(bounds[:-1], bounds[1:])), "grid"


def trim(rgba):
    a = rgba[..., 3]
    ys, xs = np.nonzero(a > 30)
    if len(xs) == 0:
        return None, None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgba[y0:y1, x0:x1], (x0, y0)


def largest_blob_bbox(a):
    """Bounding box of the column/row extent of the densest mass (ignores far sparks)."""
    occ = (a > 30)
    cols = occ.sum(axis=0)
    if cols.max() == 0:
        return None
    thr = max(2, cols.max() * 0.05)
    xs = np.nonzero(cols >= thr)[0]
    return xs.min(), xs.max()


def process_character(name):
    sheet = Image.open(RAW / f"{name}_sheet.png")
    rgba = key_sheet(sheet)
    H, W = rgba.shape[:2]
    rows = find_rows(rgba[..., 3], len(ROWS))
    frames, debug_boxes, methods = {}, [], []
    for (row_name, n), (y0, y1) in zip(ROWS, rows):
        band = rgba[y0:y1]
        grid = W / 6
        segs, how = find_frames(band[..., 3], n, grid)
        methods.append(f"{row_name}:{how}")
        frames[row_name] = []
        for (x0, x1) in segs:
            crop, off = trim(band[:, x0:x1])
            if crop is None:
                frames[row_name].append(None)
                continue
            fx, fy = x0 + off[0], y0 + off[1]
            frames[row_name].append({"img": crop, "sx": fx, "sy": fy})
            debug_boxes.append((fx, fy, fx + crop.shape[1], fy + crop.shape[0]))
    # body scale from idle frames
    idle_h = np.median([f["img"].shape[0] for f in frames["idle"] if f])
    scale = TARGET_HEIGHT / idle_h
    return rgba, rows, frames, debug_boxes, scale, methods


def anchor_of(img):
    """Feet anchor: bottom of the opaque area, x = centre of the lowest 30% mass."""
    a = img[..., 3]
    h = a.shape[0]
    low = a[int(h * 0.7):] > 60
    cols = low.sum(axis=0)
    if cols.sum() == 0:
        cols = (a > 60).sum(axis=0)
    xs = np.arange(len(cols))
    cx = float((cols * xs).sum() / max(cols.sum(), 1))
    return cx, float(h)


def pack(frames, scale):
    """Shelf-pack frames into one atlas, frames resized by `scale`."""
    items = []
    for anim, lst in frames.items():
        for i, f in enumerate(lst):
            if f is None:
                continue
            im = Image.fromarray(f["img"], "RGBA")
            w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
            im = im.resize((w, h), Image.LANCZOS)
            ax, ay = anchor_of(np.asarray(im))
            items.append((anim, i, im, ax, ay))
    maxw = 2048
    x = y = shelf = 0
    placed = []
    for anim, i, im, ax, ay in sorted(items, key=lambda t: -t[2].height):
        if x + im.width + 2 > maxw:
            x, y, shelf = 0, y + shelf + 2, 0
        placed.append((anim, i, im, ax, ay, x, y))
        x += im.width + 2
        shelf = max(shelf, im.height)
    atlas = Image.new("RGBA", (maxw, y + shelf + 2), (0, 0, 0, 0))
    meta = {}
    for anim, i, im, ax, ay, px, py in placed:
        atlas.paste(im, (px, py))
        meta.setdefault(anim, {})[i] = {"x": px, "y": py, "w": im.width, "h": im.height,
                                        "ax": round(ax, 1), "ay": round(ay, 1)}
    meta = {k: [v[i] for i in sorted(v)] for k, v in meta.items()}
    return atlas, meta


def debug_sheet(name, rgba, rows, boxes, methods):
    bg = Image.new("RGBA", (rgba.shape[1], rgba.shape[0]), (40, 40, 48, 255))
    im = Image.alpha_composite(bg, Image.fromarray(rgba, "RGBA"))
    d = ImageDraw.Draw(im)
    for y0, y1 in rows:
        d.line([(0, y0), (im.width, y0)], fill=(0, 210, 224, 255), width=2)
    for b in boxes:
        d.rectangle(b, outline=(255, 214, 10, 255), width=2)
    d.text((8, 8), " ".join(methods), fill=(255, 255, 255, 255))
    im.convert("RGB").save(DEBUG / f"{name}.jpg", quality=80)


def process_fx():
    img = Image.open(RAW / "fx.png")
    rgba = key_sheet(img)
    H, W = rgba.shape[:2]
    names = ["slash", "impact", "speedring", "dust", "guard", "crit"]
    out = {}
    tiles = []
    for k, nm in enumerate(names):
        r, c = divmod(k, 3)
        crop, _ = trim(rgba[r * H // 2:(r + 1) * H // 2, c * W // 3:(c + 1) * W // 3])
        im = Image.fromarray(crop, "RGBA")
        im.thumbnail((256, 256), Image.LANCZOS)
        tiles.append((nm, im))
    x = 0
    atlas = Image.new("RGBA", (sum(t.width + 2 for _, t in tiles), max(t.height for _, t in tiles)))
    for nm, t in tiles:
        atlas.paste(t, (x, 0))
        out[nm] = {"x": x, "y": 0, "w": t.width, "h": t.height}
        x += t.width + 2
    atlas.save(OUT / "fx.webp", "WEBP", quality=88, method=6)
    (OUT / "fx.json").write_text(json.dumps(out))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    DEBUG.mkdir(parents=True, exist_ok=True)
    index = {}
    for name in CHARACTERS:
        rgba, rows, frames, boxes, scale, methods = process_character(name)
        debug_sheet(name, rgba, rows, boxes, methods)
        atlas, meta = pack(frames, scale)
        atlas.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
        index[name] = {"atlas": f"assets/{name}.webp", "scale": round(scale, 4), "anims": meta}
        counts = {k: len(v) for k, v in meta.items()}
        print(f"{name:24s} scale={scale:.3f} {counts} {' '.join(m for m in methods if 'grid' in m)}")
        cut = Image.open(RAW / f"{name}_cutin.png").convert("RGB").resize((960, 540), Image.LANCZOS)
        cut.save(OUT / f"{name}_cutin.webp", "WEBP", quality=84, method=6)
        # portrait for the select screen: top-centre-right of the cut-in
        cw, ch = cut.size
        cut.crop((int(cw * 0.42), 0, int(cw * 0.42) + ch, ch)).resize((240, 240), Image.LANCZOS).save(
            OUT / f"{name}_face.webp", "WEBP", quality=84, method=6)
    Image.open(RAW / "stage.png").convert("RGB").resize((1280, 720), Image.LANCZOS).save(
        OUT / "stage.webp", "WEBP", quality=86, method=6)
    process_fx()
    (OUT / "sprites.json").write_text(json.dumps(index))
    print("done")


if __name__ == "__main__":
    main()
