"""Assemble the recorded frame sequences into README GIFs with the slack-gif-creator GIFBuilder.

    node e2e/record-gifs.mjs
    python e2e/make-gifs.py

Writes ideas/scary-money-manager/design/shots/*.gif. Needs: pip install pillow imageio numpy
"""
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path.home() / ".kiro" / "skills" / "slack-gif-creator"))
from core.gif_builder import GIFBuilder  # noqa: E402

FRAMES = Path(".gif-frames")
OUT = Path("ideas/scary-money-manager/design/shots")

# name -> (output width, colours). Height follows the recorded aspect ratio.
SCENES = {
    "crypt": (720, 128),
    "ghost-writes": (780, 96),
    "lights-out": (760, 128),
}

for name, (width, colours) in SCENES.items():
    folder = FRAMES / name
    meta = json.loads((folder / "meta.json").read_text())
    files = sorted(folder.glob("*.png"))
    first = Image.open(files[0])
    height = round(first.height * width / first.width)
    # Keep real-time speed: frames per second as recorded, capped for size.
    fps = max(6, min(15, round(meta["frames"] / meta["seconds"])))
    step = max(1, round((meta["frames"] / meta["seconds"]) / fps))
    builder = GIFBuilder(width=width, height=height, fps=fps)
    for f in files[::step]:
        builder.add_frame(Image.open(f))
    builder.save(OUT / f"{name}.gif", num_colors=colours, remove_duplicates=True)
