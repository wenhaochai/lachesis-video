// Lachesis promo video, v4. renderFrame(t) draws the frame at t seconds on a 1920x1080 canvas; nothing reads a clock.
// Style: a Google Research blog animation. White ground, labelled schematic pieces that build step by step, and the
// Google palette with fixed roles: blue is the kernel and its threads, yellow is the barrier, red is a failure,
// green is a pass or a proof, grey is neutral. Every label is the source's wording.
//   Cover: the pipeline, a PTX card into Lachesis (Lean checker) into a proved card, under the title.
//   Tests (after KernelBench's correctness check): random inputs A and B go into the CUTLASS GEMM kernel and into a
//     reference; the outputs build, overlay into a difference map that lies within 1e-2, one entry is compared up
//     close, and five random inputs pass one after another.
//   Bug: the kernel's card becomes one warp of 32 numbered threads above a barrier that needs one arrival. The
//     hardware picks any one thread to start the data copy. When it picks thread 0 the copy arrives and the warp
//     goes on. Rewound, it picks thread 7; the code assumed thread 0, no copy starts, and the kernel waits forever.
//   Proof: the source's five steps run on one event graph. On the CUTLASS kernel, matching the barriers finds a
//     wait no arrival completes, and the checker refuses it. On FlashAttention-3 all five steps pass quickly.
//   Results: FlashAttention-3 and FlashAttention-4, proved. The title returns.
(async () => {
  const W = 1920, H = 1080;
  const ctx = document.getElementById('c').getContext('2d', { alpha: false });
  const FACE = '"Instrument Sans"', MONO = 'Menlo, monospace';

  // ---- easing and helpers
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  function bezier(x1, y1, x2, y2) {
    const f = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
    return p => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; f(x1, x2, m) < p ? lo = m : hi = m; }
      return f(y1, y2, (lo + hi) / 2);
    };
  }
  const emph = bezier(0.2, 0, 0, 1), accel = bezier(0.3, 0, 0.8, 0.15), inOut = bezier(0.65, 0, 0.35, 1);
  const ramp = (t, at, dur) => clamp((t - at) / dur);
  const backOut = p => { const c1 = 1.5, c3 = c1 + 1; return p <= 0 ? 0 : p >= 1 ? 1 : 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; };
  const pop = (t, at, dur = 0.45) => backOut(ramp(t, at, dur));
  const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(ramp(t, a, fi), 1 - ramp(t, b, fo));
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  }
  const rgbOf = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const x = rgbOf(a), y = rgbOf(b); return '#' + x.map((v, i) => Math.round(lerp(v, y[i], clamp(p))).toString(16).padStart(2, '0')).join(''); };

  // ---- the Google palette
  const G = { blue: '#4285F4', red: '#DB4437', yellow: '#F4B400', green: '#0F9D58', grey: '#5F6368', ink: '#202124', ink2: '#3C4043', rule: '#DADCE0', soft: '#F1F3F4', paper: '#F8F9FA', arrow: '#9AA0A6' };
  const tone = (c, p) => mix('#FFFFFF', c, p);
  const font = (size, weight = 400) => `${weight} ${size}px ${FACE}`;
  // type scale, one size per role
  const TY = { title: 104, number: 58, head: 42, label: 30, caption: 32, body: 28, chip: 26, small: 24, micro: 22, code: 21 };

  // ---- primitives
  function group(cx, cy, s, a, fn) { if (s <= 0 || a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.scale(s, s); fn(); ctx.restore(); }
  function rbox(x, y, w, h, r, fill, stroke, lw = 2, dash) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.stroke(); }
    ctx.restore();
  }
  function text(s, x, y, o = {}) {
    const a = o.a ?? 1;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.font = o.mono ? `${o.weight ?? 400} ${o.size}px ${MONO}` : font(o.size, o.weight ?? 400);
    ctx.fillStyle = o.color ?? G.ink; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'alphabetic';
    ctx.fillText(s, x, y); ctx.restore();
  }
  const textW = (s, size, weight = 400, mono) => { ctx.save(); ctx.font = mono ? `${weight} ${size}px ${MONO}` : font(size, weight); const w = ctx.measureText(s).width; ctx.restore(); return w; };
  function dot(x, y, r, fill, a = 1, stroke, lw = 2) {
    if (r <= 0 || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    ctx.restore();
  }
  // a circle with a white tick or cross drawn in as p grows
  function badge(x, y, r, p, color, kind = 'check') {
    if (p <= 0) return;
    dot(x, y, r * backOut(clamp(p * 1.6)), color);
    const q = clamp((p - 0.35) / 0.65);
    if (q <= 0) return;
    ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
    if (kind === 'check') {
      const P = [[x - r * 0.42, y + r * 0.02], [x - r * 0.12, y + r * 0.32], [x + r * 0.44, y - r * 0.3]];
      const L1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), L2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]), d = emph(q) * (L1 + L2);
      ctx.moveTo(...P[0]);
      if (d <= L1) ctx.lineTo(lerp(P[0][0], P[1][0], d / L1), lerp(P[0][1], P[1][1], d / L1));
      else { ctx.lineTo(...P[1]); const f = (d - L1) / L2; ctx.lineTo(lerp(P[1][0], P[2][0], f), lerp(P[1][1], P[2][1], f)); }
    } else {
      const e = r * 0.34, f = emph(q);
      ctx.moveTo(x - e, y - e); ctx.lineTo(x - e + 2 * e * Math.min(1, f * 2), y - e + 2 * e * Math.min(1, f * 2));
      if (f > 0.5) { const g = (f - 0.5) * 2; ctx.moveTo(x + e, y - e); ctx.lineTo(x + e - 2 * e * g, y - e + 2 * e * g); }
    }
    ctx.stroke(); ctx.restore();
  }
  // a horizontal S-curve drawn from its start as p grows, with an arrowhead
  const curvePt = (x1, y1, x2, y2, s) => { const m = 1 - s; return [m ** 3 * x1 + 3 * m * m * s * (x1 + x2) / 2 + 3 * m * s * s * (x1 + x2) / 2 + s ** 3 * x2, m ** 3 * y1 + 3 * m * m * s * y1 + 3 * m * s * s * y2 + s ** 3 * y2]; };
  function arrow(x1, y1, x2, y2, p, o = {}) {
    const a = o.a ?? 1;
    if (p <= 0 || a <= 0) return;
    const color = o.color ?? G.arrow, lw = o.lw ?? 2, pt = s => curvePt(x1, y1, x2, y2, s);
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) { const [x, y] = pt(p * i / 30); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    if (p > 0.97 && o.head !== false) {
      const [xa, ya] = pt(0.95), [xb, yb] = pt(1), g = Math.atan2(yb - ya, xb - xa), hl = 8 + lw * 2;
      ctx.beginPath(); ctx.moveTo(xb, yb); ctx.lineTo(xb - hl * Math.cos(g - 0.45), yb - hl * Math.sin(g - 0.45)); ctx.lineTo(xb - hl * Math.cos(g + 0.45), yb - hl * Math.sin(g + 0.45)); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function chip(s, x, y, o = {}) {   // a rounded label; x is its left edge unless o.center
    const size = o.size ?? 26, w = textW(s, size, o.weight ?? 500) + (o.pad ?? 22) * 2 + (o.icon ? size + 8 : 0), h = size * 1.75;
    const x0 = o.center ? x - w / 2 : x;
    group(x0 + w / 2, y, o.s ?? 1, o.a ?? 1, () => {
      rbox(-w / 2, -h / 2, w, h, h / 2, o.fill ?? G.soft, o.stroke);
      let tx = -w / 2 + (o.pad ?? 22);
      if (o.icon) { badge(tx + size / 2, 0, size * 0.5, o.iconP ?? 1, o.iconColor ?? o.color, o.icon); tx += size + 8; }
      text(s, tx, size * 0.36, { size, weight: o.weight ?? 500, color: o.color ?? G.ink2 });
    });
    return w;
  }
  function clock(x, y, r, ang, color, a = 1) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * r * 0.65, y + Math.sin(ang) * r * 0.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - r * 0.45); ctx.stroke();
    ctx.restore();
  }

  // ---- timing (seconds)
  // Script time. The whole video plays SLOW times slower than these numbers, so every motion keeps its shape.
  const SLOW = 1.2;
  const T = {
    coverOut: 2.4, titleOut: 2.9,
    tIn: 3.5, cards: 3.8, guides: 4.1, feed: 4.4, build: 5.15, compare: 6.3, verdict: 7.1,
    trials: [7.85, 8.4, 8.95, 9.5], trialDur: 0.55, tOut: 10.4,
    warp: 10.8, barrier: 11.5, scan1: 11.9, copy1: 13.05, go1: 13.6, rewind: 14.7,
    scan2: 15.2, assume: 16.35, stall: 16.7, bOut: 18.7,
    pIn: 18.85, s1: 19.2, s2: 20.2, s3: 21.4, worldB: 22.5, refuse: 23.2,
    fa: 25.6, f1: 26, f2: 26.7, f3: 27.5, f4: 28.3, f5: 29.5, proved: 30.3, pOut: 31.7,
    rIn: 31.9, rOut: 36.1, title: 36.6, end: 39.7,
  };
  const DUR = T.end, HOP = 1.0;

  // ======================================================================== captions
  function riseLine(t, parts, o) {
    const out = o.out ?? Infinity, step = o.step ?? 0.035, dur = o.dur ?? 0.6;
    if (t < o.at || t > out + 0.45) return;
    ctx.save(); ctx.font = font(o.size, o.weight ?? 400); ctx.textBaseline = 'alphabetic';
    const gap = ctx.measureText(' ').width, wd = parts.map(([u]) => ctx.measureText(u).width);
    const total = wd.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    let x = o.x - total / 2;
    const lh = o.size * 1.2, oq = accel(ramp(t, out, 0.4));
    ctx.beginPath(); ctx.rect(0, o.y - o.size * 1.05, W, o.size * 1.45); ctx.clip();
    parts.forEach(([u, c], i) => {
      const q = emph(ramp(t, o.at + i * step, dur));
      if (q > 0) { ctx.globalAlpha = clamp(q * 1.6) * (1 - oq); ctx.fillStyle = c; ctx.fillText(u, x, o.y + (1 - q) * lh - oq * lh * 1.1); }
      x += wd[i] + gap;
    });
    ctx.restore();
  }
  const CAP = { size: TY.caption, maxW: 1320, y1: 884, y2: [852, 898] };
  const LIFT = 84;   // every scene with a caption is drawn this much higher
  function caption(t, sentence, accent, color, at, out) {
    if (t < at || t > out + 0.5) return;
    const words = sentence.split(' '), a0 = accent ? sentence.indexOf(accent) : -1;
    let pos = 0;
    const marked = words.map(w => { const st = pos; pos += w.length + 1; return [w, a0 >= 0 && st >= a0 && st < a0 + accent.length ? color : G.ink2]; });
    const width = ws => textW(ws.map(([w]) => w).join(' '), CAP.size);
    let lines = [marked];
    if (width(marked) > CAP.maxW) {
      let best = 1, bestD = Infinity;
      for (let k = 1; k < marked.length; k++) { const d = Math.abs(width(marked.slice(0, k)) - width(marked) / 2); if (d < bestD) { bestD = d; best = k; } }
      lines = [marked.slice(0, best), marked.slice(best)];
    }
    let n = 0;
    lines.forEach((ln, li) => {
      riseLine(t, ln, { x: W / 2, y: lines.length === 1 ? CAP.y1 : CAP.y2[li], size: CAP.size, at: at + n * 0.035, out: out + li * 0.04 });
      n += ln.length;
    });
  }
  function drawCaptions(t) {
    caption(t, 'Everyone checks kernels the same way: run them on some random inputs and compare the output with a slow reference.', 'random inputs', G.blue, T.tIn + 0.6, T.tOut);
    caption(t, "But a kernel's behavior depends on the input, the shape and the timing of thousands of threads, and no test can try them all.", 'no test can try them all.', G.red, T.warp + 0.4, T.rewind - 0.3);
    caption(t, 'Instead of proving each kernel, we would prove a checker once, so that proving a new kernel becomes a computation.', 'prove a checker once,', G.blue, T.pIn + 0.3, T.worldB - 0.2);
    caption(t, 'When a checker refuses to approve some code, it is pointing at something.', 'refuses', G.red, T.refuse + 0.15, T.fa - 0.2);
    caption(t, 'Each proof covers every input and every interleaving of threads.', 'every input and every interleaving of threads.', G.green, T.fa + 0.3, T.pOut - 0.1);
    caption(t, 'It rules out data races and out-of-bounds accesses and shows the outputs equal the math in exact arithmetic, for one fixed shape.', 'for one fixed shape.', G.blue, T.rIn + 0.6, T.rOut - 0.1);
  }

  // ======================================================================== title
  // "Lachesis:" in ink beside a blue tonal chip holding "Lean4Kernel"
  const titleWidth = size => textW('Lachesis:', size, 600) + size * 0.3 + textW('Lean4Kernel', size, 600) + size * 0.64;
  function titleMark(cx, cy, size, a, rise = 0) {
    if (a <= 0) return;
    const wL = textW('Lachesis:', size, 600), wK = textW('Lean4Kernel', size, 600), pad = size * 0.32, gap = size * 0.3;
    const total = wL + gap + wK + pad * 2, x0 = cx - total / 2, base = cy + size * 0.36 - rise;
    ctx.save(); ctx.globalAlpha *= a;
    text('Lachesis:', x0, base, { size, weight: 600, color: G.ink });
    rbox(x0 + wL + gap, cy - size * 0.66 - rise, wK + pad * 2, size * 1.32, size * 0.3, tone(G.blue, 0.14));
    text('Lean4Kernel', x0 + wL + gap + pad, base, { size, weight: 600, color: G.blue });
    ctx.restore();
  }
  function drawTitle(t) {
    if (t < T.titleOut + 0.5) { const q = accel(ramp(t, T.titleOut, 0.4)); titleMark(W / 2, 430, TY.title, 1 - q, q * 40); }
    if (t >= T.title) { const q = emph(ramp(t, T.title, 0.7)); titleMark(W / 2, 520, TY.title, q, (1 - q) * -36); }
  }

  // ======================================================================== cover: the pipeline
  const PTX = [
    ['elect.sync', ' %r1|%p1, -1;'],
    ['@%p1 ', 'cp.async.bulk.tensor.2d', ' [%r2], ...;'],
    ['mbarrier.try_wait.parity', ' %p2, [%r5], %r6;'],
    ['wgmma.mma_async.sync.aligned', ' ...;'],
    ['bar.sync', ' 0;'],
    ['st.global.v4.f32', ' [%rd8], {...};'],
  ];
  function ptxCard(cx, cy, s, a) {
    group(cx, cy, s, a, () => {
      rbox(-320, -165, 640, 330, 22, G.paper, G.rule, 1.5);
      text('PTX', -284, -118, { size: TY.small, weight: 500, color: G.grey });
      PTX.forEach((parts, i) => {
        let x = -284; const y = -66 + i * 42;
        parts.forEach(seg => {
          const op = /^[a-z]/.test(seg);
          text(seg, x, y, { size: TY.code, mono: true, color: op ? G.blue : G.grey });
          x += textW(seg, TY.code, 400, true);
        });
      });
    });
  }
  function lachesisCard(cx, cy, s, a) {
    group(cx, cy, s, a, () => {
      rbox(-140, -80, 280, 160, 26, tone(G.blue, 0.14));
      text('Lachesis', 0, -4, { size: TY.head, weight: 600, color: G.blue, align: 'center' });
      text('Lean checker', 0, 40, { size: TY.small, color: G.grey, align: 'center' });
    });
  }
  const CHECKS = ['no data races', 'no out-of-bounds accesses', 'outputs equal the math'];
  function provedCard(cx, cy, s, a, p = 1) {
    group(cx, cy, s, a, () => {
      rbox(-240, -165, 480, 330, 22, tone(G.green, 0.1));
      badge(-196, -104, 22, p, G.green);
      text('proved', -162, -90, { size: TY.head, weight: 600, color: G.green });
      CHECKS.forEach((c, i) => { badge(-190, -26 + i * 62, 14, clamp(p * 3 - 1 - i * 0.4), G.green); text(c, -164, -16 + i * 62, { size: TY.body, color: G.ink2 }); });
    });
  }
  // The cover: the title, and under it one quiet strip of an event graph: three lanes, two barriers, a few events,
  // and one happens-before path in green that ends in a check. A light runs along the path, then the strip clears.
  const STRIP = { x0: 600, x1: 1320, ly: [612, 672, 732], bars: [820, 1100], dots: [[0, 690], [0, 980], [1, 660], [1, 950], [1, 1210], [2, 900], [2, 1180]] };
  const SPATH = [[700, 732], [820, 732], [820, 612], [1236, 612]];
  function drawCover(t) {
    if (t > T.coverOut + 1.0) return;
    const out = 1 - accel(ramp(t, T.coverOut, 0.5)), a = out, dy = (1 - out) * 24;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, dy);
    STRIP.ly.forEach(y => { ctx.strokeStyle = G.rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(STRIP.x0, y); ctx.lineTo(STRIP.x1, y); ctx.stroke(); });
    STRIP.bars.forEach(b => rbox(b - 10, STRIP.ly[0] - 26, 20, STRIP.ly[2] - STRIP.ly[0] + 52, 10, tone(G.yellow, 0.5)));
    STRIP.dots.forEach(([l, x]) => dot(x, STRIP.ly[l], 8, tone(G.blue, 0.75)));
    ctx.strokeStyle = G.green; ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(...SPATH[0]); SPATH.slice(1).forEach(q => ctx.lineTo(...q)); ctx.stroke();
    dot(...SPATH[0], 10, '#FFFFFF', 1, G.green, 3);
    const seg = SPATH.slice(1).map((q, i) => Math.hypot(q[0] - SPATH[i][0], q[1] - SPATH[i][1])), total = seg.reduce((x, y) => x + y, 0);
    const run = clamp((t - 0.45) / 1.1);
    if (run > 0 && run < 1) {
      let d = emph(run) * total, i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      const f = clamp(d / seg[i]);
      const x = lerp(SPATH[i][0], SPATH[i + 1][0], f), y = lerp(SPATH[i][1], SPATH[i + 1][1], f);
      dot(x, y, 15, tone(G.green, 0.25)); dot(x, y, 7, G.green);
    }
    const pulse = 1 + 0.12 * Math.sin(Math.PI * clamp((t - 1.5) / 0.35));
    badge(SPATH[3][0] + 26, SPATH[3][1], 22 * pulse, 1, G.green);
    ctx.restore();
  }



  // ======================================================================== tests
  const RM = rng(51);
  const randn = () => { let u = 0; while (u === 0) u = RM(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * RM()); };
  const CALL = [2, 3];
  const TRIALS = [0, 1, 2, 3, 4].map(() => {
    const A = [...Array(6)].map(() => [...Array(4)].map(randn)), B = [...Array(4)].map(() => [...Array(6)].map(randn));
    const C = A.map(row => [...Array(6)].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));
    const D = C.map(row => row.map(() => (RM() - 0.5) * 6e-5));   // kernel minus reference, far inside the tolerance
    D[CALL[0]][CALL[1]] = 1.2e-5;
    return { A, B, C, D };
  });
  const fmt5 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(5);
  const shade = v => tone(G.blue, 0.1 + 0.75 * (0.5 + 0.5 * Math.tanh(v / 1.6)));
  const PITCH = 40, CELL = 35;
  const POS = { A: [420, 488], B: [420, 718], CK: [1330, 430], CR: [1330, 690], D: [1330, 560] };
  const KCARD = { x: 910, y: 430, w: 360, h: 130 }, RCARD = { x: 910, y: 690, w: 360, h: 130 };
  const GSTART = [580, 600], NUMX = 1500;
  const blend = (M0, M1, q) => M0.map((row, r) => row.map((v, c) => lerp(v, M1[r][c], q)));
  function matrix(cx, cy, M, o = {}) {
    const rows = M.length, cols = M[0].length, sc = o.scale ?? 1, P = PITCH * sc, cs = CELL * sc, a0 = o.a ?? 1;
    if (a0 <= 0) return;
    const w = cols * P - (P - cs), h = rows * P - (P - cs);
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const q = o.show ? o.show(r, c) : 1;
      if (q <= 0) continue;
      const sz = cs * (0.4 + 0.6 * emph(q)), x = cx - w / 2 + c * P + (cs - sz) / 2, y = cy - h / 2 + r * P + (cs - sz) / 2;
      ctx.globalAlpha = a0 * clamp(q * 1.5);
      ctx.fillStyle = o.color ? o.color(r, c) : shade(M[r][c]);
      ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 6 * sc); ctx.fill();
    }
    ctx.restore();
  }
  const cellXY = (cx, cy, rows, cols, r, c) => [cx - (cols * PITCH - (PITCH - CELL)) / 2 + c * PITCH + CELL / 2, cy - (rows * PITCH - (PITCH - CELL)) / 2 + r * PITCH + CELL / 2];
  function kernelCard(c, label, color, fill, s = 1, a = 1, pulse = 0) {
    group(c.x, c.y, s * (1 + 0.04 * pulse), a, () => {
      rbox(-c.w / 2, -c.h / 2, c.w, c.h, 26, fill);
      text(label, 0, 11, { size: TY.label, weight: 500, color, align: 'center' });
    });
  }
  const TILE_ORDER = [4, 0, 8, 2, 6, 1, 7, 3, 5];   // the kernel computes 2x2 tiles in parallel, the reference row by row
  function drawTests(t) {
    if (t < T.tIn || t > T.warp + 0.2) return;
    const fade = 1 - ramp(t, T.tOut, 0.35);
    let n = 0;
    T.trials.forEach((s, i) => { if (t >= s) n = i + 1; });
    const u = n ? (t - T.trials[n - 1]) / T.trialDur : 0;
    const cur = TRIALS[n], prev = TRIALS[Math.max(0, n - 1)], swap = n ? emph(clamp(u / 0.3)) : 1;
    const A = blend(prev.A, cur.A, swap), B = blend(prev.B, cur.B, swap);

    // the inputs' card
    const flick = (r, c, at) => ramp(t, at + ((r * 7 + c * 3) % 11) * 0.025, 0.3);
    matrix(...POS.A, A, { a: fade, show: (r, c) => flick(r, c, T.tIn + 0.15) });
    matrix(...POS.B, B, { a: fade, show: (r, c) => flick(r, c, T.tIn + 0.25) });

    // guides and the feed
    const toK = [...GSTART, KCARD.x - KCARD.w / 2 - 16, KCARD.y], toR = [...GSTART, RCARD.x - RCARD.w / 2 - 16, RCARD.y];
    arrow(...toK, inOut(ramp(t, T.guides, 0.5)), { a: fade });
    arrow(...toR, inOut(ramp(t, T.guides + 0.12, 0.5)), { a: fade });
    const og = fade * (1 - ramp(t, T.compare, 0.3));
    arrow(KCARD.x + KCARD.w / 2 + 16, KCARD.y, POS.CK[0] - 140, POS.CK[1], inOut(ramp(t, T.build - 0.25, 0.4)), { a: og });
    arrow(RCARD.x + RCARD.w / 2 + 16, RCARD.y, POS.CR[0] - 140, POS.CR[1], inOut(ramp(t, T.build - 0.2, 0.4)), { a: og });
    const fly = (p, a) => {
      if (p <= 0 || p >= 1) return;
      const fa = a * clamp(p / 0.12) * (1 - clamp((p - 0.82) / 0.18));
      [A, B].forEach((M, m) => [toK, toR].forEach(Gd => {
        const q = inOut(clamp((p - m * 0.1) / 0.9));
        if (q <= 0) return;
        const [x, y] = curvePt(...Gd, q);
        matrix(x, y + (m ? 24 : -24), M, { a: fa, scale: 0.3 });
      }));
    };
    fly(ramp(t, T.feed, 0.7), fade);
    if (n) fly(clamp((u - 0.12) / 0.38), fade);

    // the two cards (the kernel's card stays on into the bug)
    const pulse = Math.sin(Math.PI * clamp((t - T.feed - 0.5) / 0.35)) + (n ? Math.sin(Math.PI * clamp((u - 0.42) / 0.3)) : 0);
    kernelCard(RCARD, 'reference', G.ink2, G.soft, pop(t, T.cards + 0.1), fade, pulse);
    if (t < T.warp) kernelCard(KCARD, 'CUTLASS GEMM', G.blue, tone(G.blue, 0.14), pop(t, T.cards), 1, pulse * fade);

    // outputs, then the difference map
    const cp = inOut(ramp(t, T.compare, 0.7)), C1 = TRIALS[0].C;
    if (cp < 1) {
      const oa = fade * (1 - ramp(cp, 0.8, 0.2));
      const tileShow = (r, c) => ramp(t, T.build + TILE_ORDER.indexOf(Math.floor(r / 2) * 3 + Math.floor(c / 2)) * 0.08, 0.25);
      const rowShow = (r, c) => ramp(t, T.build + (r * 6 + c) * 0.022, 0.2);
      matrix(lerp(POS.CK[0], POS.D[0], cp), lerp(POS.CK[1], POS.D[1], cp), C1.map((row, r) => row.map((v, c) => v + TRIALS[0].D[r][c])), { a: oa, show: tileShow });
      matrix(lerp(POS.CR[0], POS.D[0], cp), lerp(POS.CR[1], POS.D[1], cp), C1, { a: oa, show: rowShow });
    }
    if (cp > 0.75) {
      // every entry of |out - ref| lies inside the tolerance: the cells sweep to green, and again for each new input
      const sweep = (r, c) => ramp(t, T.compare + 0.55 + (r + c) * 0.03, 0.25);
      const resweep = (r, c) => n ? 1 - 0.6 * Math.sin(Math.PI * clamp((u - 0.45 - (r + c) * 0.02) / 0.3)) : 1;
      matrix(...POS.D, C1, { a: fade * ramp(cp, 0.75, 0.25), color: (r, c) => mix(shade(C1[r][c]), tone(G.green, 0.22), sweep(r, c) * resweep(r, c)) });
      text('|out − ref|', POS.D[0], POS.D[1] - 146, { size: TY.small, weight: 500, color: G.grey, align: 'center', a: fade * ramp(t, T.compare + 0.7, 0.3) });
    }
    // one entry up close, the tolerance, and the five random inputs
    const va = ramp(t, T.verdict, 0.3) * fade;
    if (va > 0) {
      const [cx, cy] = cellXY(...POS.D, 6, 6, ...CALL);
      ctx.save(); ctx.globalAlpha = va; ctx.strokeStyle = G.ink; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(cx - CELL / 2 - 4, cy - CELL / 2 - 4, CELL + 8, CELL + 8, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + CELL / 2 + 4, cy); ctx.lineTo(NUMX - 16, cy); ctx.stroke(); ctx.restore();
      const shown = TRIALS[n && u > 0.85 ? n : Math.max(0, n - 1)];
      const kv = shown.C[CALL[0]][CALL[1]] + shown.D[CALL[0]][CALL[1]], rv = shown.C[CALL[0]][CALL[1]];
      text(fmt5(kv), NUMX, cy - 4, { size: TY.label, weight: 500, color: G.blue, a: va });
      text(fmt5(rv), NUMX, cy + 36, { size: TY.label, color: G.grey, a: va });
      chip('≤ 1e-2', POS.D[0], 740, { center: true, size: TY.chip, color: G.green, fill: tone(G.green, 0.14), icon: 'check', iconColor: G.green, iconP: ramp(t, T.verdict + 0.15, 0.35), s: pop(t, T.verdict + 0.05), a: fade });
      for (let i = 0; i < 5; i++) {
        const x = POS.D[0] + (i - 2) * 46, at = i === 0 ? T.verdict + 0.25 : T.trials[i - 1] + T.trialDur * 0.85;
        dot(x, 818, 16, null, va, G.rule, 2);
        badge(x, 818, 16, ramp(t, at, 0.3), G.green);
      }
    }
  }

  // ======================================================================== bug: one warp and its barrier
  const WARP = { x: 960, y: 400, w: 1240, h: 300 };
  const CP = 72, CS = 60;   // cell pitch and size
  const cellPos = k => [WARP.x - (16 * CP - (CP - CS)) / 2 + (k % 16) * CP + CS / 2, WARP.y + 4 + Math.floor(k / 16) * 76];
  const BAR = { x: 960, y: 745, w: 440, h: 150 };
  const HOP1 = [21, 5, 14, 26, 9, 0], HOP2 = [3, 18, 11, 29, 2, 7];
  function hop(t, at, seq) {
    const u = clamp((t - at) / HOP) * (seq.length - 1), i = Math.min(Math.floor(u), seq.length - 2), f = emph(clamp(u - i));
    const [x0, y0] = cellPos(seq[i]), [x1, y1] = cellPos(seq[i + 1]);
    return { x: lerp(x0, x1, f), y: lerp(y0, y1, f), landed: u >= seq.length - 1, k: seq[seq.length - 1] };
  }
  function drawBug(t) {
    if (t < T.warp || t > T.bOut + 0.4) return;
    const out = 1 - ramp(t, T.bOut, 0.35);
    // the kernel's card grows into the warp's card
    const m = inOut(ramp(t, T.warp, 0.7));
    const cw = lerp(KCARD.w, WARP.w, m), ch = lerp(KCARD.h, WARP.h, m), cx = lerp(KCARD.x, WARP.x, m), cy = lerp(KCARD.y, WARP.y, m);
    ctx.save(); ctx.globalAlpha = out; rbox(cx - cw / 2, cy - ch / 2, cw, ch, 26, tone(G.blue, lerp(0.14, 0.08, m))); ctx.restore();
    const la = m < 0.5 ? 1 - m * 2 : (m - 0.5) * 2;
    text('CUTLASS GEMM', m < 0.5 ? cx : cx - cw / 2 + 36, m < 0.5 ? cy + 11 : cy - ch / 2 + 54, { size: TY.label, weight: 500, color: G.blue, align: m < 0.5 ? 'center' : 'left', a: out * la });
    text('one warp, 32 threads', WARP.x + WARP.w / 2 - 36, WARP.y - WARP.h / 2 + 54, { size: TY.small, color: G.grey, align: 'right', a: out * ramp(t, T.warp + 0.6, 0.3) });

    // phases: the first pick lands on thread 0 and the warp goes on; after the rewind it lands on thread 7
    const beat2 = t >= T.rewind + 0.3;
    const pk = t >= T.scan2 ? hop(t, T.scan2, HOP2) : t >= T.scan1 && t < T.rewind + 0.3 ? hop(t, T.scan1, HOP1) : null;
    const goP = beat2 ? 0 : ramp(t, T.go1, 0.5) * (1 - ramp(t, T.rewind, 0.3));
    const waitP = ramp(t, T.stall, 0.8);
    for (let k = 0; k < 32; k++) {
      const [x, y] = cellPos(k), s = pop(t, T.warp + 0.45 + (k % 16) * 0.012 + Math.floor(k / 16) * 0.05, 0.4);
      const picked = pk && pk.landed && pk.k === k;
      let fill = '#FFFFFF', num = G.grey, stroke = tone(G.blue, 0.45);
      if (goP > 0) { const g = clamp(goP * 1.6 - (k % 16) * 0.03); fill = mix('#FFFFFF', tone(G.green, 0.25), g); stroke = mix(stroke, tone(G.green, 0.6), g); }
      if (beat2 && waitP > 0 && !picked) { fill = mix('#FFFFFF', G.soft, waitP); stroke = mix(stroke, G.rule, waitP); }
      if (picked) { fill = G.blue; num = '#FFFFFF'; stroke = G.blue; }
      group(x, y, s, out, () => {
        rbox(-CS / 2, -CS / 2, CS, CS, 14, fill, stroke, 2);
        text(String(k), 0, 8, { size: TY.micro, weight: 500, color: num, align: 'center' });
      });
    }
    // the hardware's pick hops across the threads
    if (pk) {
      const a = out * (beat2 ? ramp(t, T.scan2, 0.15) : ramp(t, T.scan1, 0.15) * (1 - ramp(t, T.rewind, 0.3)));
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = G.blue; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(pk.x - CS / 2 - 7, pk.y - CS / 2 - 7, CS + 14, CS + 14, 18); ctx.stroke(); ctx.restore();
    }
    // the code assumed thread 0: a dashed red ring on it
    if (beat2 && t >= T.assume) {
      const [x, y] = cellPos(0);
      ctx.save(); ctx.globalAlpha = out * ramp(t, T.assume, 0.3); ctx.strokeStyle = G.red; ctx.lineWidth = 3.5; ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.roundRect(x - CS / 2 - 8, y - CS / 2 - 8, CS + 16, CS + 16, 18); ctx.stroke(); ctx.restore();
    }
    // the barrier: one arrival lets the warp through
    const arrived = !beat2 && t >= T.go1 && t < T.rewind + 0.15;
    const done = arrived ? ramp(t, T.go1, 0.3) * (1 - ramp(t, T.rewind, 0.15)) : 0;
    const stuck = beat2 ? ramp(t, T.stall, 0.4) : 0;
    group(BAR.x, BAR.y, pop(t, T.barrier), out, () => {
      rbox(-BAR.w / 2, -BAR.h / 2, BAR.w, BAR.h, 26, mix(tone(G.yellow, 0.2), tone(G.green, 0.16), done));
      text('barrier', -BAR.w / 2 + 34, -14, { size: TY.label, weight: 500, color: G.ink2 });
      text('arrivals', -BAR.w / 2 + 34, 30, { size: TY.small, color: G.grey });
      const pulseR = stuck ? 0.5 + 0.5 * Math.sin((t - T.stall) * Math.PI * 2 / 0.9) : 0;
      text(arrived ? '1 / 1' : '0 / 1', 34, 20, { size: TY.number, weight: 600, color: done ? G.green : mix(G.ink, G.red, stuck * (0.55 + 0.45 * pulseR)), align: 'center' });
      if (done) badge(BAR.w / 2 - 48, 0, 22, done, G.green);
      if (stuck) clock(BAR.w / 2 - 48, 0, 20, (t - T.stall) * 3.2, G.red, stuck);
    });
    // the copy: started by thread 0 in the first beat, it reaches the barrier
    if (!beat2 && t >= T.copy1 && t < T.go1 + 0.1) {
      // it leaves thread 0 from under the warp's card and slides into the barrier's card
      const q = inOut(ramp(t, T.copy1 + 0.1, 0.45)), [x0] = cellPos(0);
      const [x, y] = curvePt(x0, WARP.y + WARP.h / 2 + 46, BAR.x - BAR.w / 2 + 90, BAR.y, q);
      ctx.save(); ctx.globalAlpha = out * (1 - ramp(t, T.go1, 0.2)); ctx.strokeStyle = G.blue; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(x0, cellPos(16)[1] + CS / 2 + 6); ctx.lineTo(x0, lerp(cellPos(16)[1] + CS / 2 + 6, WARP.y + WARP.h / 2 + 26, ramp(t, T.copy1, 0.15))); ctx.stroke(); ctx.restore();
      chip('data copy', x, y, { center: true, size: TY.small, color: '#FFFFFF', fill: G.blue, s: pop(t, T.copy1, 0.3), a: out * (1 - ramp(t, T.go1 - 0.05, 0.12)) });
    }
    // the source's words, one line at a time between the warp and the barrier
    const l1 = win(t, T.scan1 - 0.1, T.rewind, 0.4, 0.3), l2 = win(t, T.assume - 0.05, T.bOut, 0.4, 0.3);
    text('pick any one thread to start each data copy', W / 2, 622, { size: TY.label, color: G.grey, align: 'center', a: l1 * out });
    if (l2 > 0) {
      const s1 = 'then assume it picked ', s2 = 'thread 0', w1 = textW(s1, TY.label), w2 = textW(s2, TY.label, 500), x0 = W / 2 - (w1 + w2) / 2;
      text(s1, x0, 622, { size: TY.label, color: G.grey, a: l2 * out });
      text(s2, x0 + w1, 622, { size: TY.label, weight: 500, color: G.red, a: l2 * out });
    }
    text('the kernel waits forever', W / 2, 876, { size: TY.label, weight: 500, color: G.red, align: 'center', a: out * win(t, T.stall + 0.3, T.bOut, 0.4, 0.3) });
  }

  // ======================================================================== proof: five steps on one event graph
  const STEPS = ['Fix the shape', 'Unroll the loops', 'Match the barriers', 'Find the paths', 'Get the values'];
  let SW, SX;   // measured on first use, once the fonts are in
  function stepLayout() {
    if (SW) return;
    SW = STEPS.map(s => textW(s, TY.chip, 500) + 22 + 28 + 14 + 26);
    const gap = 20, x0 = W / 2 - (SW.reduce((a, b) => a + b, 0) + gap * 4) / 2;
    SX = SW.map((w, i) => x0 + SW.slice(0, i).reduce((a, b) => a + b, 0) + i * gap);
  }
  // each step's state at t: 0 pending, 1 active, 2 done, 3 refused, and when it last changed
  function stepState(i, t) {
    if (t < T.fa) {
      const A = [T.s1, T.s2, T.s3];
      if (i > 2 || t < A[i]) return [0, -9];
      if (i === 2) return t >= T.refuse ? [3, T.refuse] : [1, A[2]];
      return t >= A[i + 1] ? [2, A[i + 1]] : [1, A[i]];
    }
    const B = [T.f1, T.f2, T.f3, T.f4, T.f5, T.proved];
    if (t < B[i]) return [0, -9];
    return t >= B[i + 1] ? [2, B[i + 1]] : [1, B[i]];
  }
  function drawSteps(t, a) {
    stepLayout();
    STEPS.forEach((s, i) => {
      const [st, at] = stepState(i, t), w = SW[i], x = SX[i], y = 150, h = 52, sc = 1 + 0.08 * Math.sin(Math.PI * clamp((t - at) / 0.3));
      const fill = [null, G.blue, null, tone(G.red, 0.14)][st], col = ['#9AA0A6', '#FFFFFF', G.green, G.red][st];
      group(x + w / 2, y, sc * pop(t, T.pIn + i * 0.06, 0.4), a, () => {
        if (fill) rbox(-w / 2, -h / 2, w, h, h / 2, fill);
        const cx = -w / 2 + 22 + 14;
        if (st === 2) badge(cx, 0, 14, 1, G.green);
        else if (st === 3) badge(cx, 0, 14, 1, G.red, 'cross');
        else { dot(cx, 0, 14, st === 1 ? '#FFFFFF' : null, 1, st === 1 ? null : '#DADCE0', 1.5); text(String(i + 1), cx, 7, { size: 18, weight: 600, color: st === 1 ? G.blue : '#80868B', align: 'center' }); }
        text(s, cx + 28, 9, { size: TY.chip, weight: 500, color: col });
      });
    });
  }
  // lanes of the event graph
  const LX0 = 360, LX1 = 1720, LANE_A = ['thread 0', 'thread 7', 'other threads', 'TMA'], LANE_B = ['warp 0', 'warp 1', 'TMA', 'tensor core'];
  const LY = [380, 490, 600, 710];
  // the CUTLASS run: elect, thread 0 starts the copy, TMA copies and completes, the barrier releases the waits
  const EA = { elect: 480, start: 640, copy: 760, done: 900, bar: 1040, wait: 1180, work: 1400 };
  function drawGraphA(t, a) {
    if (a <= 0) return;
    const lanes = ramp(t, T.s1 + 0.2, 0.6), ev = x => pop(t, T.s2 + (x - LX0) / (LX1 - LX0) * 0.8, 0.4);
    const B = ramp(t, T.worldB, 0.4);   // the other world: the hardware picked thread 7
    LANE_A.forEach((name, i) => {
      text(name, LX0 - 30, LY[i] + 9, { size: TY.chip, weight: 500, color: G.grey, align: 'right', a: a * lanes });
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = G.rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LX0, LY[i]); ctx.lineTo(lerp(LX0, LX1, inOut(lanes)), LY[i]); ctx.stroke(); ctx.restore();
    });
    // the barrier spans the three thread lanes
    group(EA.bar, (LY[0] + LY[2]) / 2, ev(EA.bar), a, () => rbox(-14, -(LY[2] - LY[0]) / 2 - 28, 28, LY[2] - LY[0] + 56, 14, tone(G.yellow, 0.55)));
    // elect: a diamond on the chosen thread's lane
    const ey = lerp(LY[0], LY[1], inOut(B));
    group(EA.elect, ey, ev(EA.elect), a, () => { ctx.save(); ctx.rotate(Math.PI / 4); rbox(-11, -11, 22, 22, 4, G.blue); ctx.restore(); });
    text('elect', EA.elect, ey - 26, { size: TY.micro, color: G.grey, align: 'center', a: a * ramp(t, T.s2 + 0.2, 0.3) });
    // the copy exists only in the world where thread 0 was picked
    const cA = a * (1 - 0.75 * B);
    dot(EA.start, LY[0], 11 * ev(EA.start), G.blue, cA);
    dot(EA.copy, LY[3], 11 * ev(EA.copy), G.blue, cA);
    dot(EA.done, LY[3], 11 * ev(EA.done), G.yellow, cA);
    arrow(EA.start + 12, LY[0] + 8, EA.copy - 14, LY[3] - 6, ramp(t, T.s2 + 0.3, 0.4), { a: cA, color: G.blue, dash: B > 0.5 ? [6, 6] : null });
    // matching: the completion arrives at the barrier, the barrier releases each wait
    const match = inOut(ramp(t, T.s3 + 0.1, 0.4));
    arrow(EA.done + 12, LY[3], EA.bar - 16, LY[2] + 30, match, { a: a * (1 - 0.75 * B), color: B > 0.5 ? G.red : G.yellow, lw: 3, dash: B > 0.5 ? [6, 6] : null });
    [0, 1, 2].forEach(i => {
      arrow(EA.bar + 16, LY[i], EA.wait - 16, LY[i], ramp(t, T.s3 + 0.3 + i * 0.06, 0.3), { a, color: mix(G.yellow, G.red, ramp(t, T.refuse, 0.2)), lw: 3 });
      const r = ramp(t, T.refuse + i * 0.05, 0.3);
      dot(EA.wait, LY[i], 12 * ev(EA.wait), '#FFFFFF', a, mix(G.yellow, G.red, r), 3);
      if (t < T.worldB) badge(EA.wait, LY[i] - 30, 11, ramp(t, T.s3 + 0.45 + i * 0.06, 0.3) * (1 - ramp(t, T.worldB - 0.15, 0.15)), G.green);
      else badge(EA.wait, LY[i] - 30, 11, r, G.red, 'cross');
      dot(EA.work, LY[i], 11 * ev(EA.work), G.blue, a * (1 - 0.6 * r));
    });
    chip('refused', EA.bar, LY[3] + 90, { center: true, size: TY.label, color: G.red, fill: tone(G.red, 0.14), icon: 'cross', iconColor: G.red, iconP: ramp(t, T.refuse + 0.1, 0.35), s: pop(t, T.refuse + 0.05), a });
  }
  // the FlashAttention-3 run: a ring of buffers, three barrier phases, conflicting writes and reads joined by paths
  const RB = rng(77), EB = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) EB.push({ lane: i, x: lerp(LX0 + 60, LX1 - 160, (j + RB() * 0.6) / 9) });
  const PH = [640, 960, 1280];
  const PAIRS = PH.map(b => ({ w: [b - 120, LY[2]], r: [b + 100, LY[3]], b }));
  function drawGraphB(t, a) {
    if (a <= 0) return;
    const lanes = ramp(t, T.fa, 0.4), ev = x => pop(t, T.f2 + (x - LX0) / (LX1 - LX0) * 0.6, 0.35);
    LANE_B.forEach((name, i) => {
      text(name, LX0 - 30, LY[i] + 9, { size: TY.chip, weight: 500, color: G.grey, align: 'right', a: a * lanes });
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = G.rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LX0, LY[i]); ctx.lineTo(LX1, LY[i]); ctx.stroke(); ctx.restore();
    });
    PH.forEach(x => group(x, (LY[0] + LY[3]) / 2, ev(x), a, () => rbox(-12, -(LY[3] - LY[0]) / 2 - 26, 24, LY[3] - LY[0] + 52, 12, tone(G.yellow, 0.5))));
    EB.forEach(e => {
      if (PH.some(b => Math.abs(e.x - b) < 44)) return;
      if (PAIRS.some(P => (e.lane === 2 && e.x > P.w[0] - 34 && e.x < P.b + 34) || (e.lane === 3 && e.x > P.b - 34 && e.x < P.r[0] + 34))) return;
      dot(e.x, LY[e.lane], 9 * ev(e.x), e.lane === 2 ? G.blue : tone(G.blue, 0.7), a);
    });
    // match the barriers: every wait is completed by an arrival
    const m = ramp(t, T.f3, 0.6);
    PH.forEach((b, k) => [0, 1, 3].forEach(i => { if (m > 0) arrow(b + 14, LY[i], b + 60, LY[i], clamp(m * 1.6 - k * 0.3), { a, color: G.yellow, lw: 3 }); }));
    // find the paths: each conflicting write and read is joined through a barrier
    PAIRS.forEach((P, k) => {
      const at = T.f4 + k * 0.35, q = ramp(t, at, 0.4), hit = ramp(t, at - 0.15, 0.2);
      dot(...P.w, 11, '#FFFFFF', a * hit, mix(G.red, G.green, q), 3);
      dot(...P.r, 11, '#FFFFFF', a * hit, mix(G.red, G.green, q), 3);
      if (q > 0) {
        const pts = [P.w, [P.b, P.w[1]], [P.b, P.r[1]], P.r];
        const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = seg.reduce((x, y) => x + y, 0);
        let d = emph(q) * total;
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = G.green; ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(...pts[0]);
        for (let i = 0; i < seg.length; i++) {
          if (d >= seg[i]) { ctx.lineTo(...pts[i + 1]); d -= seg[i]; }
          else { const f = d / seg[i]; ctx.lineTo(lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)); break; }
        }
        ctx.stroke(); ctx.restore();
      }
    });
    // get the values: the output
    dot(LX1 - 70, LY[0], 13 * pop(t, T.f5, 0.3), G.green, a);
    chip('outputs equal the math', LX1 - 110, LY[0] - 62, { center: true, size: TY.chip, color: G.green, fill: tone(G.green, 0.14), icon: 'check', iconColor: G.green, iconP: ramp(t, T.f5 + 0.15, 0.3), s: pop(t, T.f5 + 0.05), a });
    chip('proved', EA.bar, LY[3] + 90, { center: true, size: TY.label, color: G.green, fill: tone(G.green, 0.14), icon: 'check', iconColor: G.green, iconP: ramp(t, T.proved + 0.1, 0.35), s: pop(t, T.proved + 0.05), a });
  }
  function drawProof(t) {
    if (t < T.pIn || t > T.pOut + 0.5) return;
    const out = 1 - ramp(t, T.pOut, 0.35);
    drawSteps(t, out);
    // the kernel under proof, with the launch it is proved for
    const kA = 1 - ramp(t, T.fa - 0.2, 0.25), kB = ramp(t, T.fa, 0.3);
    chip('CUTLASS GEMM', 120, 262, { size: 26, color: G.blue, fill: tone(G.blue, 0.14), s: pop(t, T.pIn + 0.1), a: out * kA });
    chip('FlashAttention-3', 120, 262, { size: 26, color: G.blue, fill: tone(G.blue, 0.14), s: pop(t, T.fa), a: out * kB });
    drawGraphA(t, out * (1 - ramp(t, T.fa - 0.25, 0.3)));
    drawGraphB(t, out * ramp(t, T.fa, 0.3));
  }
  // the warp's threads drop into the lanes, and the barrier's card narrows into the barrier, as the proof begins
  function drawCarry(t) {
    if (t < T.bOut || t > T.s1 + 0.9) return;
    const q = inOut(ramp(t, T.bOut, 0.8)), a = 1 - ramp(t, T.s1 + 0.4, 0.3);
    for (let k = 0; k < 32; k++) {
      const [x0, y0] = cellPos(k), lane = k === 0 ? 0 : k === 7 ? 1 : 2;
      const x = lerp(x0, LX0 + 8, q), y = lerp(y0, LY[lane], q), s = lerp(CS, 16, q);
      ctx.save(); ctx.globalAlpha = a; rbox(x - s / 2, y - s / 2, s, s, lerp(14, 8, q), k === 7 ? G.blue : mix('#FFFFFF', tone(G.blue, 0.5), q), tone(G.blue, 0.45), 2); ctx.restore();
    }
    const bw = lerp(BAR.w, 28, q), bh = lerp(BAR.h, LY[2] - LY[0] + 56, q), bx = lerp(BAR.x, EA.bar, q), by = lerp(BAR.y, (LY[0] + LY[2]) / 2, q);
    ctx.save(); ctx.globalAlpha = a; rbox(bx - bw / 2, by - bh / 2, bw, bh, lerp(26, 14, q), mix(tone(G.yellow, 0.2), tone(G.yellow, 0.55), q)); ctx.restore();
  }

  // ======================================================================== results
  function resultCard(t, cx, cy, name, sub, at, a) {
    group(cx, cy, pop(t, at, 0.5), a, () => {
      rbox(-350, -215, 700, 430, 30, G.paper);
      text(name, -300, -122, { size: TY.head, weight: 600, color: G.ink });
      text(sub, -300, -80, { size: TY.small, color: G.grey });
      chip('proved', 300 - (textW('proved', TY.chip, 500) + 44 + 34), -136, { size: TY.chip, color: G.green, fill: tone(G.green, 0.14), icon: 'check', iconColor: G.green, iconP: ramp(t, at + 0.35, 0.3) });
      CHECKS.forEach((c, i) => { badge(-286, 4 + i * 64, 15, ramp(t, at + 0.45 + i * 0.12, 0.35), G.green); text(c, -258, 14 + i * 64, { size: TY.body, color: G.ink2, a: ramp(t, at + 0.45 + i * 0.12, 0.3) }); });
    });
  }
  function drawResults(t) {
    if (t < T.rIn || t > T.rOut + 0.5) return;
    const a = 1 - accel(ramp(t, T.rOut, 0.4));
    resultCard(t, 560, 560, 'FlashAttention-3', 'about 9,200 lines of PTX, 512 threads', T.rIn, a);
    resultCard(t, 1360, 560, 'FlashAttention-4', 'about 714,000 events', T.rIn + 0.25, a);
  }

  // ---- the Princeton shield, small in the bottom-right corner for the whole video
  const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const PRIN = await load('../assets/logos/princeton-shield.svg');
  function drawMark() { const sh = 52, sw = sh * PRIN.naturalWidth / PRIN.naturalHeight; ctx.drawImage(PRIN, 1860 - sw, 1034 - sh / 2, sw, sh); }

  function frame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    drawCover(t);
    ctx.save(); ctx.translate(0, -LIFT);
    drawTests(t);
    drawBug(t);
    drawCarry(t);
    drawProof(t);
    drawResults(t);
    ctx.restore();
    drawTitle(t);
    drawCaptions(t);
    drawMark();
  }

  window.DUR = DUR * SLOW;
  window.renderFrame = async t => { frame(t / SLOW); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  await Promise.all([font(112, 600), font(96, 600), font(58, 600), font(48, 600), font(42, 600), font(36, 600), font(34, 500), font(34, 400), font(32, 500), font(30, 500), font(30, 400),
    font(28, 400), font(26, 500), font(26, 400), font(24, 500), font(24, 400), font(22, 500), font(22, 400), font(18, 600), font(32, 400)].map(f => document.fonts.load(f)));
  frame(0);
  window.__ready = true;
})();
