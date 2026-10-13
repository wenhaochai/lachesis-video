# Lachesis promo video

A 31-second promo for Lachesis, the Lean verifier that proves GPU kernels correct from their PTX, at 1920 × 1080 and 60 fps, silent. It follows the look of a Google Research blog animation: white ground, labelled schematic pieces that build step by step, Instrument Sans, and the Google palette with fixed roles. Blue is the kernel and its threads, yellow is the barrier, red is a failure, green is a pass or a proof. The Princeton shield sits in the bottom-right corner throughout. Every label is the blog post's wording.

- **Cover.** The pipeline under the title "Lachesis: Lean4Kernel": a PTX card into Lachesis (Lean checker) into a proved card.
- **Tests.** After KernelBench's correctness check, its Figure 1 and its eval code, which uses `torch.allclose` with atol = rtol = 1e-2 over five random inputs. Random inputs A and B go into the CUTLASS GEMM kernel and into a reference. The kernel's output builds tile by tile and the reference's row by row; they overlay into |out − ref|, which sweeps green; one entry is compared up close; five random inputs pass.
- **Bug.** The kernel's card becomes one warp of 32 numbered threads above a barrier that needs one arrival. The hardware picks any one thread to start each data copy. When it picks thread 0 the copy arrives, 1 / 1, and the warp goes on. Rewound, it picks thread 7; the code assumed thread 0, the barrier stays at 0 / 1, and the kernel waits forever.
- **Proof.** The blog's five steps run as labels over one event graph. On the CUTLASS kernel, matching the barriers finds waits no arrival completes once thread 7 is picked, and the checker refuses it. On FlashAttention-3 all five steps pass: barrier phases matched, conflicting writes and reads joined by paths, outputs equal the math.
- **Results.** FlashAttention-3 (about 9,200 lines of PTX, 512 threads) and FlashAttention-4 (about 714,000 events), each proved: no data races, no out-of-bounds accesses, outputs equal the math. The title returns.

## Files

- `src/video.html` and `src/video.js`: the director. `renderFrame(t)` draws the frame at `t` seconds and reads no clock. Timings sit in `T` near the top of `video.js`. `src/video.v1.bak.js` to `src/video.v3.bak.js` keep the earlier thread-motif cuts in black, white and Princeton orange.
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
