"""Copy the Taka sign (U+09F3) from Hind Siliguri into Plus Jakarta Sans.

Plus Jakarta Sans has no glyph for U+09F3, so Android silently falls back to a
system font and the sign looks different wherever plain text contains it.
This writes patched copies to assets/fonts/ that the app loads instead of the
npm package files. Re-run after upgrading either font package:

    python scripts/patch-taka-font.py
"""
import glob
import os

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = os.path.join(ROOT, "node_modules", "@expo-google-fonts")
OUT = os.path.join(ROOT, "assets", "fonts")

# Jakarta weight -> Hind weight that matches its stroke thickness
PAIRS = {
    "400Regular": "400Regular",
    "500Medium": "500Medium",
    "600SemiBold": "600SemiBold",
    "700Bold": "700Bold",
    "800ExtraBold": "700Bold",
}
TAKA = 0x09F3
HEIGHT_RATIO = 0.80   # taka height relative to the digit height: reads as a prefix, not a letter
SIDE_BEARING = 30     # font units on each side


def bounds(font, glyph_name):
    pen = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[glyph_name].draw(pen)
    return pen.bounds


def patch(jakarta_weight, hind_weight):
    src = glob.glob(os.path.join(NM, "plus-jakarta-sans", jakarta_weight, "*.ttf"))[0]
    hind_path = glob.glob(os.path.join(NM, "hind-siliguri", hind_weight, "*.ttf"))[0]
    font, hind = TTFont(src), TTFont(hind_path)

    digit = font.getBestCmap()[ord("0")]
    _, d_ymin, _, d_ymax = bounds(font, digit)
    taka_src = hind.getBestCmap()[TAKA]
    t_xmin, t_ymin, t_xmax, t_ymax = bounds(hind, taka_src)

    scale = (d_ymax - d_ymin) * HEIGHT_RATIO / (t_ymax - t_ymin)
    dx = SIDE_BEARING - t_xmin * scale
    dy = -t_ymin * scale  # sit on the baseline like the digits

    pen = TTGlyphPen(None)
    hind.getGlyphSet()[taka_src].draw(TransformPen(pen, (scale, 0, 0, scale, dx, dy)))
    glyph = pen.glyph()

    name = "uni09F3"
    font.setGlyphOrder(font.getGlyphOrder() + [name])
    font["glyf"][name] = glyph
    glyph.recalcBounds(font["glyf"])
    advance = round((t_xmax - t_xmin) * scale + 2 * SIDE_BEARING)
    font["hmtx"][name] = (advance, glyph.xMin)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[TAKA] = name
    font["maxp"].numGlyphs = len(font.getGlyphOrder())

    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, f"PlusJakartaSans_{jakarta_weight}.ttf")
    font.save(dest)
    print(f"{os.path.basename(dest)}: taka from Hind {hind_weight}, scale {scale:.3f}, advance {advance}")


if __name__ == "__main__":
    for jw, hw in PAIRS.items():
        patch(jw, hw)
