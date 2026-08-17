from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "marketing" / "tiktok-ready-assets"

for name in ("base", "stage-1", "stage-2", "stage-3", "outro"):
    source = Image.open(ASSETS / f"{name}.png").convert("RGBA")
    source.resize((2160, 3840), Image.Resampling.LANCZOS).save(
        ASSETS / f"{name}-4k.png",
        optimize=True,
    )
