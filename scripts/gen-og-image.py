#!/usr/bin/env python3
"""Generate ogpeek's 1200x630 social card (og.png).

Aesthetic = precision instrument: warm-black canvas, single signal-amber
accent, JetBrains-Mono-feel grid. Self-contained, no external fonts needed.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
# Warm-black canvas (matches style.css --bg)
BG = (13, 13, 15)          # #0d0d0f
AMBER = (255, 180, 84)     # #ffb454
DIM = (40, 40, 46)         # grid lines
MUTE = (150, 148, 142)     # muted text
INK = (237, 234, 228)      # primary text


def load_font(size, bold=False):
    """Try several monospace fonts available on the system; fall back to default."""
    candidates = [
        "Consolas", "DejaVuSansMono", "LiberationMono",
        "Menlo", "Monaco", "Courier New",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name + ".ttf", size)
        except Exception:
            pass
    # last resort: PIL default
    return ImageFont.load_default()


def draw_centered(draw, text, font, y, color, center_x=W // 2):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((center_x - tw // 2, y), text, font=font, fill=color)
    return bbox[3] - bbox[1]


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # --- subtle dot grid (instrument feel) ---
    spacing = 40
    for x in range(spacing, W, spacing):
        for y in range(spacing, H, spacing):
            d.point((x, y), fill=DIM)

    # --- corner tick marks (camera/viewfinder feel) ---
    tick = 28
    margin = 48
    corners = [
        (margin, margin),            # TL
        (W - margin, margin),        # TR
        (margin, H - margin),        # BL
        (W - margin, H - margin),    # BR
    ]
    for cx, cy in corners:
        dx = -1 if cx > W // 2 else 1
        dy = -1 if cy > H // 2 else 1
        d.line([(cx, cy), (cx + dx * tick, cy)], fill=AMBER, width=2)
        d.line([(cx, cy), (cx, cy + dy * tick)], fill=AMBER, width=2)

    # --- top kicker ---
    fk = load_font(20)
    d.text((margin, margin + 38), "SOCIAL CARD INSPECTOR", font=fk, fill=MUTE)

    # --- brand mark (box + inner box + dot) matching favicon ---
    brand_y = 130
    bx = margin
    d.rectangle([bx, brand_y, bx + 44, brand_y + 44], outline=AMBER, width=2)
    d.rectangle([bx + 12, brand_y + 12, bx + 32, brand_y + 32], outline=AMBER, width=1)
    d.ellipse([bx + 18, brand_y + 18, bx + 26, brand_y + 26], fill=AMBER)

    # --- wordmark "ogpeek" ---
    fw = load_font(72, bold=True)
    d.text((bx + 64, brand_y - 6), "og", font=fw, fill=INK)
    og_w = d.textbbox((0, 0), "og", font=fw)[2]
    d.text((bx + 64 + og_w, brand_y - 6), "peek", font=fw, fill=AMBER)

    # --- headline ---
    fh = load_font(40, bold=True)
    d.text((margin, 240), "See your link the way", font=fh, fill=INK)
    d.text((margin, 296), "every platform sees it.", font=fh, fill=INK)

    # --- platform chips row ---
    fc = load_font(22)
    platforms = ["X / Twitter", "Facebook", "LinkedIn", "Slack", "Discord", "iMessage"]
    cx = margin
    cy = 388
    for p in platforms:
        tw = d.textbbox((0, 0), p, font=fc)
        w = tw[2] - tw[0]
        pad_x, pad_y = 16, 10
        box_w = w + pad_x * 2
        box_h = 38
        d.rounded_rectangle([cx, cy, cx + box_w, cy + box_h], radius=8, outline=DIM, width=1)
        d.text((cx + pad_x, cy + pad_y - 2), p, font=fc, fill=MUTE)
        cx += box_w + 14

    # --- value line ---
    fv = load_font(24)
    d.text((margin, 470), "Catch broken og:image & twitter:card tags before your users do.",
           font=fv, fill=MUTE)

    # --- bottom bar ---
    fb = load_font(20)
    d.line([(margin, H - margin - 36), (W - margin, H - margin - 36)], fill=DIM, width=1)
    d.text((margin, H - margin - 22), "Free  ·  No signup  ·  Runs in your browser",
           font=fb, fill=INK)
    url_text = "18606559294.github.io/ogpeek"
    uw = d.textbbox((0, 0), url_text, font=fb)[2]
    d.text((W - margin - uw, H - margin - 22), url_text, font=fb, fill=AMBER)

    out = os.path.join(os.path.dirname(__file__), "..", "og.png")
    img.save(out, "PNG", optimize=True)
    print("wrote", os.path.abspath(out), os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
