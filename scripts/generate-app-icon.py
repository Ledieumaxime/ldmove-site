"""Build the Android launcher icon from the LD Move logo.

Run from the project root:

    python3 scripts/generate-app-icon.py

The source logo is not usable as an icon as it stands. Three things happen
to it here:

1. Only the figure and the ring are kept. The "LD MOVE" lettering is a few
   pixels tall once the icon is drawn at 48dp and reads as grey smudge.

2. The ring is redrawn closed. In the logo it is an open arc, and the gap
   is where the lettering sits; with the text gone the gap reads as a
   mistake rather than a choice. The replacement is not a fresh circle:
   it is the circle least-squares-fitted to the original arc, so centre,
   radius and proportions are the logo's own.

3. The hairline is thickened. At 4px on a 500px logo the ring lands under
   one screen pixel on a phone and disappears into a haze.

The adaptive icon is the fiddly part. Its canvas is 108dp but a launcher
only ever shows the middle 72dp, and only the middle 66dp is guaranteed
against clipping by whatever mask the phone uses. So the artwork is drawn
at 44% of the foreground canvas, which lands at about two thirds of the
visible area: the proportion this was designed at, without the ring
touching a mask edge. The legacy square icons have no mask, so there the
artwork is drawn at the two thirds directly.
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "src/assets/logo-ldmove.png"
RES = ROOT / "android/app/src/main/res"

BACKGROUND = (26, 24, 22, 255)   # near-black, warmer than pure #000
FOREGROUND = (245, 240, 232, 255)  # the sand of the site
BACKGROUND_HEX = "#1A1816"

# Artwork as a share of the canvas. See the note above on why they differ.
ADAPTIVE_FRACTION = 0.44
LEGACY_FRACTION = 0.66

STROKE = 9        # ring thickness, in source-logo pixels
SUPERSAMPLE = 8   # PIL cannot draw a smooth ring; draw big, shrink down

DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def shapes(alpha):
    """Every separate blob in the logo, largest first."""
    w, h = alpha.size
    px = alpha.load()
    solid = [[px[x, y] > 128 for x in range(w)] for y in range(h)]
    seen = [[False] * w for _ in range(h)]
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if not solid[y0][x0] or seen[y0][x0]:
                continue
            queue = deque([(x0, y0)])
            seen[y0][x0] = True
            pts = []
            while queue:
                x, y = queue.popleft()
                pts.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and solid[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        queue.append((nx, ny))
            out.append(pts)
    out.sort(key=len, reverse=True)
    return out


def fit_circle(pts):
    """Least-squares circle through the arc, so the closed ring keeps the
    logo's geometry instead of being an arbitrary new circle."""
    n = len(pts)
    sx = sum(p[0] for p in pts)
    sy = sum(p[1] for p in pts)
    sxx = sum(p[0] ** 2 for p in pts)
    syy = sum(p[1] ** 2 for p in pts)
    sxy = sum(p[0] * p[1] for p in pts)
    sxxx = sum(p[0] ** 3 for p in pts)
    syyy = sum(p[1] ** 3 for p in pts)
    sxyy = sum(p[0] * p[1] ** 2 for p in pts)
    sxxy = sum(p[0] ** 2 * p[1] for p in pts)
    a = n * sxx - sx * sx
    b = n * sxy - sx * sy
    c = n * syy - sy * sy
    d = 0.5 * (n * sxyy - sx * syy + n * sxxx - sx * sxx)
    e = 0.5 * (n * sxxy - sy * sxx + n * syyy - sy * syy)
    det = a * c - b * b
    cx = (d * c - b * e) / det
    cy = (a * e - b * d) / det
    r = sum(((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 for p in pts) / n
    return cx, cy, r


def build_artwork():
    """The figure inside a closed ring, as a transparency mask."""
    logo = Image.open(LOGO).convert("RGBA")
    w, h = logo.size
    alpha = logo.split()[3]
    src = alpha.load()

    blobs = shapes(alpha)
    figure_pts, arc_pts = blobs[0], blobs[1]
    cx, cy, r = fit_circle(arc_pts)

    big = Image.new("L", (w * SUPERSAMPLE, h * SUPERSAMPLE), 0)
    ImageDraw.Draw(big).ellipse(
        [(cx - r) * SUPERSAMPLE, (cy - r) * SUPERSAMPLE,
         (cx + r) * SUPERSAMPLE, (cy + r) * SUPERSAMPLE],
        outline=255,
        width=STROKE * SUPERSAMPLE,
    )
    ring = big.resize((w, h), Image.LANCZOS)

    # Reuse the source alpha so the figure keeps its anti-aliased edge.
    figure = Image.new("L", (w, h), 0)
    fp = figure.load()
    for x, y in figure_pts:
        fp[x, y] = src[x, y]

    art = Image.new("L", (w, h), 0)
    art.paste(ring, (0, 0), ring)
    art.paste(figure, (0, 0), figure)
    return art.crop(art.getbbox())


def render(art, size, fraction, background):
    canvas = Image.new("RGBA", (size, size), background)
    target = int(size * fraction)
    scale = target / max(art.size)
    small = art.resize(
        (max(1, int(art.width * scale)), max(1, int(art.height * scale))),
        Image.LANCZOS,
    )
    tint = Image.new("RGBA", small.size, FOREGROUND)
    tint.putalpha(small)
    canvas.paste(tint, ((size - small.width) // 2, (size - small.height) // 2), tint)
    return canvas


def circular(img):
    size = img.size[0]
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask.resize(img.size, Image.LANCZOS))
    return out


def main():
    art = build_artwork()

    for density, (legacy, adaptive) in DENSITIES.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)

        square = render(art, legacy, LEGACY_FRACTION, BACKGROUND)
        square.save(folder / "ic_launcher.png")
        circular(square).save(folder / "ic_launcher_round.png")
        render(art, adaptive, ADAPTIVE_FRACTION, (0, 0, 0, 0)).save(
            folder / "ic_launcher_foreground.png"
        )
        print(f"{density}: {legacy}px + foreground {adaptive}px")

    colors = RES / "values/ic_launcher_background.xml"
    colors.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{BACKGROUND_HEX}</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )
    print(f"fond: {BACKGROUND_HEX}")

    # A leftover vector foreground from the Capacitor template would win
    # over the PNG on API 24+ and quietly restore the default icon.
    stale = RES / "drawable-v24/ic_launcher_foreground.xml"
    if stale.exists():
        stale.unlink()
        print("supprime: drawable-v24/ic_launcher_foreground.xml")


if __name__ == "__main__":
    main()
