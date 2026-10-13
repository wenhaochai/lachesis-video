"""Tile the stills from `node src/render.mjs --times ...` into one contact sheet, each frame's time under it.

    python3 src/sheet.py OUT.png [--cols 4] [--width 640] [--times 1,2.5,...]

Without --times it takes every stills/t_*.png in time order.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('--cols', type=int, default=4)
ap.add_argument('--width', type=int, default=640)
ap.add_argument('--times', default=None)
a = ap.parse_args()

stills = HERE.parent / 'stills'
if a.times:
    files = [stills / f't_{float(x):05.2f}.png' for x in a.times.split(',')]
else:
    files = sorted(stills.glob('t_*.png'), key=lambda p: float(p.stem[2:]))
w = a.width
h = round(w * 1080 / 1920)
pad, cap = 10, 30
rows = -(-len(files) // a.cols)
sheet = Image.new('RGB', (a.cols * (w + pad) + pad, rows * (h + cap + pad) + pad), '#D9DCE1')
draw = ImageDraw.Draw(sheet)
face = ImageFont.truetype(str(HERE.parent / 'assets/fonts/InstrumentSans-Medium.ttf'), 18)
for k, f in enumerate(files):
    x, y = pad + (k % a.cols) * (w + pad), pad + (k // a.cols) * (h + cap + pad)
    sheet.paste(Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS), (x, y))
    draw.text((x + 4, y + h + 5), f'{float(f.stem[2:]):.2f} s', fill='#202124', font=face)
sheet.save(a.out)
print(a.out, len(files), 'frames')
