# Lachesis promo video

A 30-second promo for Lachesis, the Lean verifier that proves GPU kernels correct from their PTX, at 1920 × 1080 and 60 fps, silent. White, black lines, and one accent, Princeton orange #F58025, set in Instrument Sans. The Princeton shield sits in the bottom-right corner throughout.

One motif carries the piece: GPU threads are 32 black lines that run the full width of the frame and ripple together. Lachesis measures them with small orange rings that slide along each line; a measured stretch turns orange and its happens-before links weave in between the lines.

- **Cover.** The woven orange net under the title "Lachesis: Lean4Kernel". The net slides out to the left.
- **Tests.** The threads stream in. Five random inputs drop into them; each time the outputs match the reference values under them and a tick is added. The first test plays slowly, the other four fast.
- **Bug.** A gate closes on the bundle. The hardware picks one thread. When it picks thread 0, the gate opens and everything flows. Rewound, it picks another thread, the gate stays shut, and work piles up against it.
- **Proof.** Rings measure every thread up to the jam and stop there. They blink, cannot pass, and the orange withdraws.
- **Scale.** Every thread splits into FlashAttention-3 (512 threads) above and FlashAttention-4 (714,000 events) below. Both are measured end to end and woven orange, then interleave into the net of the cover. The video ends on the net.

## Files

- `src/video.html` and `src/video.js`: the director. `renderFrame(t)` draws the frame at `t` seconds and reads no clock. Timings sit in `T` near the top of `video.js`. `src/video.v1.bak.js` keeps the first cut, a boxed bundle on the left half of the frame.
- `src/render.mjs`: drives the Chromium that Playwright caches over the DevTools protocol with Node 22, no npm packages.
- `src/sheet.py`: tiles test stills into one contact sheet.
- `assets/fonts/`: Instrument Sans under the SIL Open Font License. `assets/logos/`: the Princeton shield.

## Rebuilding

Serve this folder on port 8795 in its own terminal, then render and encode from this folder:

```bash
python3 -m http.server 8795
node src/render.mjs --workers 6
ffmpeg -framerate 60 -i "$TMPDIR/lachesis-frames/f_%04d.png" -c:v libx264 -preset veryslow -tune animation -crf 20 -pix_fmt yuv420p -movflags +faststart lachesis.mp4
```

Frames go to `$TMPDIR/lachesis-frames`; the renderer skips frames that already exist, so a stopped render resumes. `node src/render.mjs --times 1,5.5,12` draws single frames into `stills/`, and `python3 src/sheet.py sheet.png` tiles them. `video.html?scrub` adds a slider in a browser, and `video.html?t=12` shows one moment.
