"""
Shared helpers for the hand-drawn (Pillow) diagrams.

* font(size, bold): first TrueType font found from a cross-platform candidate list
  (DejaVu on Linux, Segoe UI / Arial on Windows, Helvetica / Arial on macOS); falls back to
  Pillow's built-in font if none is available, so the scripts never crash on a missing font.
* OUT_DIR: docs/images/diagrams resolved from this file's location, so the scripts can be run
  from any working directory:  python docs/src/diagram-content-update-flow.py
"""
from pathlib import Path
from PIL import ImageFont

OUT_DIR = Path(__file__).resolve().parents[1] / "images" / "diagrams"
OUT_DIR.mkdir(parents=True, exist_ok=True)

_REGULAR = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",          # Debian/Ubuntu
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",                   # Fedora
    "C:/Windows/Fonts/segoeui.ttf",                             # Windows
    "C:/Windows/Fonts/arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",             # macOS
    "/Library/Fonts/Arial.ttf",
    "DejaVuSans.ttf", "segoeui.ttf", "arial.ttf",               # let Pillow search the system font folders
]
_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "DejaVuSans-Bold.ttf", "segoeuib.ttf", "arialbd.ttf",
]

_warned = False


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    global _warned
    for candidate in (_BOLD if bold else _REGULAR):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    if not _warned:
        print("warning: no TrueType font found; using Pillow's built-in font (install DejaVu or Arial for nicer output)")
        _warned = True
    try:
        return ImageFont.load_default(size)  # Pillow >= 10.1 supports a size
    except TypeError:
        return ImageFont.load_default()
