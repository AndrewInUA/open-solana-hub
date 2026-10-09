"""Hero card: a slot and an epoch are two different clocks. 1280x720."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
out = "/Users/freedigitalnomad/Documents/Solana/Projects/open-solana-hub/content/media/solana-200ms-slots-card.png"

img = Image.new("RGB", (W, H), (7, 10, 18))
px = img.load()
for y in range(H):
    for x in range(W):
        # left glow (violet) and right glow (teal), kept apart
        lx = (x - 300) / 520
        ly = (y - 380) / 420
        rx = (x - 980) / 520
        ry = (y - 380) / 420
        lg = max(0.0, 1 - (lx * lx + ly * ly))
        rg = max(0.0, 1 - (rx * rx + ry * ry))
        r = int(8 + lg * 28 + rg * 4)
        g = int(10 + lg * 8 + rg * 36)
        b = int(20 + lg * 40 + rg * 28)
        px[x, y] = (min(r, 255), min(g, 255), min(b, 255))

overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(overlay)

d.line([(640, 160), (640, 560)], fill=(180, 196, 214, 36), width=1)

font_kicker = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
font_big = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 84)

# Two facts only. Anything extra belongs in the caption under the picture.
d.text((88, 268), "A SLOT LASTS", font=font_kicker, fill=(176, 160, 230, 230))
d.text((84, 308), "200 ms", font=font_big, fill=(244, 246, 250, 255))
d.text((724, 268), "AN EPOCH LASTS", font=font_kicker, fill=(120, 210, 196, 230))
d.text((720, 308), "about a day", font=font_big, fill=(244, 246, 250, 255))

img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
img.save(out, "PNG", optimize=True)
print(out, img.size)
