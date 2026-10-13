// Lachesis promo video. renderFrame(t) draws the frame at t seconds on a 1920x1080 canvas; nothing reads a clock.
// One motif carries the piece: GPU threads are 32 black lines that run the full width of the frame and ripple
// together; Lachesis measures them with small Princeton-orange rings that slide along each line, and a measured
// stretch turns orange while its happens-before links weave in between the lines.
//   Cover: the woven orange net with the title above it. The net slides out to the left.
//   Tests, after KernelBench's correctness check (its Figure 1 and eval code): random inputs A and B go into the
//     CUTLASS GEMM kernel and into a reference; the kernel's output builds tile by tile, the reference's row by row;
//     the two outputs overlay into a difference map that stays blank, one cell's two values agree within 1e-2,
//     and the count runs to 5 / 5 over four more sets of random inputs. The kernel's box opens into its 32 threads.
//   Bug: a gate (the barrier) closes on the bundle. The hardware picks one thread; when it picks thread 0 the
//     gate opens and everything flows. Rewound, it picks another thread, the gate stays shut, and work piles up.
//   Proof: rings measure every thread up to the jam and stop there; they blink, cannot pass, and the orange
//     withdraws to the left edge.
//   Scale: each thread splits in two, into FlashAttention-3 above and FlashAttention-4 below, which are measured
//     end to end and woven orange, then interleave into the net of the cover. The video ends on the net.
(async () => {
  const W = 1920, H = 1080;
  const ctx = document.getElementById('c').getContext('2d', { alpha: false });
  const FACE = '"Instrument Sans"';

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
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  }

  // ---- black and white with one accent, Princeton orange, which only marks what Lachesis has measured
  const K = { ink: '#15171A', grey: '#8A8F96', org: '#F58025' };
  const font = (size, weight = 400) => `${weight} ${size}px ${FACE}`;

  // ---- type: words rise one by one from under their line and leave by rising out of it
  function riseLine(t, parts, o) {
    const out = o.out ?? Infinity, step = o.step ?? 0.05, dur = o.dur ?? 0.7;
    if (t < o.at || t > out + 0.45) return;
    ctx.save(); ctx.font = font(o.size, o.weight); ctx.textBaseline = 'alphabetic';
    const units = [];
    parts.forEach(([s, c]) => s.split(' ').filter(Boolean).forEach(u => units.push([u, c])));
    const gap = ctx.measureText(' ').width, wd = units.map(([u]) => ctx.measureText(u).width);
    const total = wd.reduce((a, b) => a + b, 0) + gap * (units.length - 1);
    let x = o.align === 'center' ? o.x - total / 2 : o.align === 'right' ? o.x - total : o.x;
    const lh = o.size * 1.25, oq = accel(ramp(t, out, 0.4));
    ctx.beginPath(); ctx.rect(0, o.y - o.size * 1.05, W, o.size * 1.45); ctx.clip();
    units.forEach(([u, c], i) => {
      const q = emph(ramp(t, o.at + i * step, dur));
      if (q > 0) { ctx.globalAlpha = clamp(q * 1.6) * (1 - oq); ctx.fillStyle = c; ctx.fillText(u, x, o.y + (1 - q) * lh - oq * lh * 1.1); }
      x += wd[i] + gap;
    });
    ctx.restore();
  }
  const textW = (s, size, weight) => { ctx.save(); ctx.font = font(size, weight); const w = ctx.measureText(s).width; ctx.restore(); return w; };

  // ---- primitives
  function strand(yf, x0, x1, color, lw, a = 1) {
    if (x1 <= x0 + 0.5 || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = x0, first = true; ; x += 10) {
      const xx = Math.min(x, x1), y = yf(xx);
      first ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y); first = false;
      if (xx >= x1) break;
    }
    ctx.stroke(); ctx.restore();
  }
  function dot(x, y, r, color, a = 1) {
    if (r <= 0 || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function ring(x, y, r, a = 1, lw = 2.2) {
    if (r <= 0 || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = K.org; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function tick(x, y, s, p, color = K.ink) {
    if (p <= 0) return;
    const P = [[x - s * 0.5, y], [x - s * 0.15, y + s * 0.35], [x + s * 0.5, y - s * 0.35]];
    const L1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), L2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
    const d = emph(p) * (L1 + L2);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...P[0]);
    if (d <= L1) ctx.lineTo(lerp(P[0][0], P[1][0], d / L1), lerp(P[0][1], P[1][1], d / L1));
    else { ctx.lineTo(...P[1]); const f = (d - L1) / L2; ctx.lineTo(lerp(P[1][0], P[2][0], f), lerp(P[1][1], P[2][1], f)); }
    ctx.stroke(); ctx.restore();
  }
  function link(x1, y1, x2, y2, color, lw, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2); ctx.stroke(); ctx.restore();
  }

  // ---- timing (seconds)
  const T = {
    unravel: 1.0, titleOut: 2.2,
    inputs: 2.4, boxes: 2.8, guides: 3.1, feed: 3.5, build: 4.2, compare: 5.3, verdict: 6.0,
    trials: [6.75, 7.2, 7.65, 8.1], trialDur: 0.45, testOut: 8.75,
    open: 9.1, gate: 10.2, label0: 10.3,
    scan1: 10.7, pulse1: 11.35, open1: 11.85, rewind: 13.1,
    scan2: 13.7, pile: 14.4,
    proof: 16.6, halt: 18.8, drain: 19.8,
    split: 20.4, names: 21.1, meas3: 21.6, meas4: 22.1, namesOut: 25.6,
    merge: 26.0, end: 30.0,
  };
  const DUR = T.end;

  // ---- the ripple every thread shares: a slow wave travelling right, and a band that swells and narrows
  const XL = -40, XR = W + 40, XG = 1200;
  const ripple = (x, t, amp = 30) => amp * Math.sin(0.0031 * x - 0.55 * t + 0.6) + amp * 0.35 * Math.sin(0.0074 * x + 0.8 * t + 2.1);
  const swell = (x, t) => 1 + 0.14 * Math.sin(0.0022 * x + 0.35 * t + 1.3);
  const fine = (x, ph, t, amp = 2.4) => amp * Math.sin(0.011 * x + ph + 0.9 * t);

  // ---- the bundle: 32 threads around y = 560
  const N = 32, YC = 560, DY = 12;
  const R = rng(3);
  const PH = Array.from({ length: N }, () => R() * Math.PI * 2);
  // The threads come out of the kernel's box: squeezed inside it at first, then spread to their places.
  const BOXK = { x: 760, y: 420, w: 380, h: 140 }, BOXR = { x: 760, y: 690, w: 380, h: 140 };
  // Near the box the threads are gathered to its height; away from it they fan out. The gathering relaxes as the box fades.
  const pinch = t => 1 - inOut(ramp(t, T.open + 0.55, 0.9));
  const yB = (k, x, t) => {
    // the bundle is centred on the box while it opens, then settles at the middle of the frame
    const yc = t < T.open + 1.6 ? lerp(BOXK.y, YC, 1 - pinch(t)) : YC;
    const y = yc + (k - (N - 1) / 2) * DY * swell(x, t) + ripple(x, t) + fine(x, PH[k], t), pc = pinch(t);
    if (pc <= 0) return y;
    const g = pc * Math.exp(-(((x - BOXK.x) / (BOXK.w * 0.75)) ** 2));
    return lerp(y, BOXK.y + (k - (N - 1) / 2) * 3.4, g);
  };
  const SPIN = Array.from({ length: N }, () => R() * 0.35);
  const OFF = Array.from({ length: N }, () => R());

  // ---- the two kernels: every thread splits into one above and one below, 32 threads each
  function band(seed, yc, nLinks) {
    const r = rng(seed), th = [];
    for (let j = 0; j < N; j++) th.push({ j, ph: r() * Math.PI * 2, s: r() * 0.7, d: 2.3 + r() * 0.7, us: r() * 0.3 });
    const links = [];
    for (let i = 0; i < nLinks; i++) {
      const a = Math.floor(r() * N), b = clamp(a + (1 + Math.floor(r() * 3)) * (r() < 0.5 ? -1 : 1), 0, N - 1);
      if (a === b) continue;
      const x1 = lerp(40, W - 120, r()), x2 = x1 + 24 + r() * 70;
      links.push({ a, b, x1, x2 });
    }
    return { yc, th, links };
  }
  const B3 = band(31, 360, 120), B4 = band(41, 740, 120);
  const BDY = 6.6;   // thread spacing inside a kernel's band
  const yBand = (B, h, x, t) => B.yc + (h.j - (N - 1) / 2) * BDY * swell(x, t) + ripple(x, t, 18) + fine(x, h.ph, t, 1.6);
  // the net: the two kernels interleave, FlashAttention-3 on even slots, FlashAttention-4 on odd ones
  const NDY = 7.2;
  const yNet = (B, h, x, t) => YC + ((2 * h.j + (B === B4 ? 1 : 0)) - (2 * N - 1) / 2) * NDY * swell(x, t) + ripple(x, t, 26) + fine(x, h.ph, t, 1.6);

  // ---- links of the bundle, woven as the rings pass in the proof
  const RL = rng(23), BLINKS = [];
  for (let i = 0; i < 80; i++) {
    const a = Math.floor(RL() * N), b = clamp(a + (1 + Math.floor(RL() * 3)) * (RL() < 0.5 ? -1 : 1), 0, N - 1);
    if (a === b) continue;
    const x1 = lerp(20, XG - 160, RL()), x2 = x1 + 24 + RL() * 60;
    BLINKS.push({ a, b, x1, x2 });
  }
  const PILE_N = 6, pileX = m => XG - 9 - m * 9;
  const RING_STOP = pileX(PILE_N - 1) - 18;
  const RS = Array.from({ length: N }, () => ({ s: T.proof + 0.1 + R() * 0.5, d: 1.4 + R() * 0.45 }));
  const ringX = (k, t) => lerp(XL, RING_STOP, inOut(ramp(t, RS[k].s, RS[k].d)));
  // after the halt the measurement withdraws along each thread, back to the left edge
  const orangeEnd = (k, t) => Math.min(ringX(k, t), lerp(RING_STOP, XL, inOut(ramp(t, T.drain + OFF[k] * 0.15, 0.5))));

  // The bundle's span: out of the kernel's box to the left edge and the gate, through the open gate, back again.
  function bundleSpan(k, t) {
    const p = inOut(ramp(t, T.open + SPIN[k] * 0.25, 0.95));
    const x0 = lerp(BOXK.x - BOXK.w / 2 + 10, XL, p);
    let x1 = lerp(BOXK.x + BOXK.w / 2 - 10, XG, p);
    x1 = lerp(x1, XR, inOut(ramp(t, T.open1 + 0.15 + SPIN[k] * 0.4, 0.8)));
    x1 = lerp(x1, XG, inOut(ramp(t, T.rewind + SPIN[k] * 0.4, 0.45)));
    return [x0, x1];
  }
  // The hardware's pick: a black dot hops across threads and lands; first on thread 0, later on thread 13.
  const HOP1 = [17, 6, 24, 2, 11, 0], HOP2 = [5, 21, 9, 27, 3, 13], XPICK = 780;
  function pick(t) {
    const hop = (seq, at) => {
      const u = clamp((t - at) / 0.6) * (seq.length - 1), i = Math.min(Math.floor(u), seq.length - 2);
      return { k: lerp(seq[i], seq[i + 1], emph(clamp(u - i))), landed: u >= seq.length - 1, last: seq[seq.length - 1] };
    };
    if (t >= T.scan1 && t < T.rewind + 0.3) return { ...hop(HOP1, T.scan1), a: ramp(t, T.scan1, 0.15) * (1 - ramp(t, T.rewind, 0.3)) };
    if (t >= T.scan2 && t < T.split + 0.4) return { ...hop(HOP2, T.scan2), a: ramp(t, T.scan2, 0.15) * (1 - ramp(t, T.split, 0.4)) };
    return null;
  }
  // a fractional thread index, for the picker gliding between threads
  const yAt = (kf, x, t) => { const k0 = Math.floor(kf), k1 = Math.min(N - 1, k0 + 1); return lerp(yB(k0, x, t), yB(k1, x, t), kf - k0); };

  function drawBundle(t) {
    if (t < T.open || t > T.split + 0.05) return;
    const pk = pick(t), ta = ramp(t, T.open, 0.25);
    const lw = k => pk && pk.landed && pk.last === k ? lerp(2, 4.4, pk.a) : 2;
    for (let k = 0; k < N; k++) {
      const yf = x => yB(k, x, t);
      const [x0, x1] = bundleSpan(k, t);
      strand(yf, x0, x1, K.ink, lw(k), ta);
      if (t >= T.proof) strand(yf, XL, orangeEnd(k, t), K.org, lw(k) + 0.6);
    }
    if (t >= T.proof) BLINKS.forEach(L => {
      const a = Math.min(ramp(orangeEnd(L.a, t), L.x1, 30), ramp(orangeEnd(L.b, t), L.x2, 30));
      link(L.x1, yB(L.a, L.x1, t), L.x2, yB(L.b, L.x2, t), K.org, 1.6, a);
    });
    // the gate, which splits open in the pass and stays shut after the rewind
    const gateA = ramp(t, T.gate, 0.4) * (1 - ramp(t, T.split, 0.4));
    const open = inOut(ramp(t, T.open1, 0.3)) * (1 - inOut(ramp(t, T.rewind + 0.05, 0.4)));
    if (gateA > 0) {
      const top = yB(0, XG, t) - 30, bot = yB(N - 1, XG, t) + 30, mid = (top + bot) / 2, half = (bot - top) / 2 * emph(ramp(t, T.gate, 0.45)), shift = open * 110;
      ctx.save(); ctx.globalAlpha = gateA * (1 - open * 0.9); ctx.strokeStyle = K.ink; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(XG, mid - half - shift); ctx.lineTo(XG, mid - shift);
      ctx.moveTo(XG, mid + shift); ctx.lineTo(XG, mid + half + shift);
      ctx.stroke(); ctx.restore();
    }
    // pass: thread 0 carries the copy to the gate, then work flows through the open gate
    if (t >= T.pulse1 && t < T.open1 + 0.05) { const x = lerp(XPICK, XG - 8, inOut(ramp(t, T.pulse1, 0.5))); dot(x, yB(0, x, t), 5.2, K.ink); }
    if (t >= T.open1 + 0.1 && t < T.rewind) for (let k = 0; k < N; k++) {
      const p = ramp(t, T.open1 + 0.15 + OFF[k] * 0.35, 0.8);
      if (p > 0 && p < 1) { const x = lerp(XG - 40, W, inOut(p)); dot(x, yB(k, x, t), 3.6, K.ink); }
    }
    // stuck: every thread keeps sending work, and it piles up against the gate
    if (t >= T.pile) {
      const pa = 1 - ramp(t, T.split, 0.4);
      for (let k = 0; k < N; k++) for (let m = 0; m < PILE_N; m++) {
        const e = T.pile + OFF[k] * 0.4 + m * 0.36;
        if (t < e) continue;
        const x = Math.min((t - e) * 900, pileX(m));
        dot(x, yB(k, x, t), 3.6, K.ink, pa);
      }
    }
    if (pk && pk.a > 0) dot(XPICK, yAt(pk.k, XPICK, t), 7.5, K.ink, pk.a);
    // Lachesis's rings: they measure each thread up to the jam, stop, and blink
    if (t >= T.proof) {
      const blink = t > T.halt ? 1 + 0.4 * Math.max(0, Math.sin((t - T.halt) * Math.PI * 2 / 0.5)) * (1 - ramp(t, T.halt + 1.0, 0.1)) : 1;
      for (let k = 0; k < N; k++) {
        const x = ringX(k, t), a = 1 - ramp(t, T.drain, 0.3);
        ring(x, yB(k, x, t), 5.2 * blink, a, 2);
      }
    }
  }

  // ---- the two kernels, then the net
  function threadY(B, h, x, t) {
    const ps = inOut(ramp(t, T.split + h.us * 0.5, 1.0)), pm = inOut(ramp(t, T.merge + h.us, 1.2));
    return lerp(lerp(yB(h.j, x, t), yBand(B, h, x, t), ps), yNet(B, h, x, t), pm);
  }
  const front = (h, t, at) => lerp(XL, XR, inOut(ramp(t, at + h.s, h.d)));
  function drawBand(B, t, at) {
    const x1 = lerp(XG, XR, inOut(ramp(t, T.split + 0.1, 1.0)));
    B.th.forEach(h => {
      const yf = x => threadY(B, h, x, t), f = front(h, t, at);
      strand(yf, XL, x1, K.ink, 1.6);
      if (f > XL + 0.5) strand(yf, XL, Math.min(f, x1), K.org, 1.9);
    });
    B.links.forEach(L => {
      const ha = B.th[L.a], hb = B.th[L.b];
      const a = Math.min(ramp(front(ha, t, at), L.x1, 30), ramp(front(hb, t, at), L.x2, 30));
      link(L.x1, threadY(B, ha, L.x1, t), L.x2, threadY(B, hb, L.x2, t), K.org, 1.2, a);
    });
    B.th.forEach(h => {
      if (h.j % 3) return;
      const p = ramp(t, at + h.s, h.d);
      if (p <= 0 || p >= 1) return;
      const f = front(h, t, at);
      ring(f, threadY(B, h, f, t), 4.4, ramp(p, 0, 0.04) * (1 - ramp(p, 0.94, 0.06)), 1.8);
    });
  }
  function drawKernels(t) {
    if (t < T.split) return;
    drawBand(B3, t, T.meas3);
    drawBand(B4, t, T.meas4);
    const lx = 120, w3 = textW('FlashAttention-3', 40, 500), w4 = textW('FlashAttention-4', 40, 500);
    riseLine(t, [['FlashAttention-3', K.ink]], { x: lx, y: 200, size: 40, weight: 500, at: T.names, out: T.namesOut });
    riseLine(t, [['512 threads', K.grey]], { x: lx + w3 + 28, y: 200, size: 40, weight: 400, at: T.names + 0.25, out: T.namesOut });
    riseLine(t, [['FlashAttention-4', K.ink]], { x: lx, y: 966, size: 40, weight: 500, at: T.names + 0.15, out: T.namesOut });
    riseLine(t, [['714,000 events', K.grey]], { x: lx + w4 + 28, y: 966, size: 40, weight: 400, at: T.names + 0.4, out: T.namesOut });
  }

  // ---- the cover: the finished net, which slides out to the left
  function drawCover(t) {
    if (t > 2.6) return;
    const la = 1 - ramp(t, T.unravel, 0.35);
    [B3, B4].forEach(B => B.links.forEach(L => {
      const ha = B.th[L.a], hb = B.th[L.b];
      link(L.x1, yNet(B, ha, L.x1, t), L.x2, yNet(B, hb, L.x2, t), K.org, 1.2, la);
    }));
    [B3, B4].forEach(B => B.th.forEach(h => {
      const x1 = lerp(XR, XL, inOut(ramp(t, T.unravel + h.us * 1.3 + (B === B4 ? 0.08 : 0), 0.75)));
      strand(x => yNet(B, h, x, t), XL, x1, K.org, 1.9);
    }));
  }

  // ---- the tests, after KernelBench's correctness check: random inputs go through the kernel and a reference,
  //      and the two outputs must agree within atol = rtol = 1e-2 on five sets of random inputs
  const rgbOf = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(p)))).join(',')})`; };
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
  const shade = v => 0.08 + 0.74 * (0.5 + 0.5 * Math.tanh(v / 1.6));
  const PITCH = 40, CELL = 35;
  const POS = { A: [230, 400], B: [230, 690], CK: [1180, 420], CR: [1180, 690], D: [1490, 555] };
  const GSTART = [380, 545];
  const blend = (M0, M1, q) => M0.map((row, r) => row.map((v, c) => lerp(v, M1[r][c], q)));

  function matrix(cx, cy, M, o = {}) {
    const rows = M.length, cols = M[0].length, sc = o.scale ?? 1, P = PITCH * sc, cs = CELL * sc;
    const w = cols * P - (P - cs), h = rows * P - (P - cs), a0 = o.a ?? 1;
    if (a0 <= 0) return;
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const q = o.show ? o.show(r, c) : 1;
      if (q <= 0) continue;
      const sz = cs * (0.4 + 0.6 * emph(q)), x = cx - w / 2 + c * P + (cs - sz) / 2, y = cy - h / 2 + r * P + (cs - sz) / 2;
      ctx.globalAlpha = a0 * clamp(q * 1.5);
      ctx.fillStyle = o.color ? o.color(r, c) : mix('#FFFFFF', K.ink, shade(M[r][c]));
      ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 3 * sc); ctx.fill();
      if (o.outline) { ctx.strokeStyle = '#C3C7CC'; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    ctx.restore();
  }
  const cellXY = (cx, cy, rows, cols, r, c) => [cx - (cols * PITCH - (PITCH - CELL)) / 2 + c * PITCH + CELL / 2, cy - (rows * PITCH - (PITCH - CELL)) / 2 + r * PITCH + CELL / 2];
  function box(B, label, a, pulse = 0, la = 1, fill = true) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = K.ink; ctx.lineWidth = 2 + pulse * 1.6;
    ctx.beginPath(); ctx.roundRect(B.x - B.w / 2, B.y - B.h / 2, B.w, B.h, 18); if (fill) ctx.fill(); ctx.stroke();
    if (la > 0) { ctx.globalAlpha = a * la; ctx.fillStyle = K.ink; ctx.font = font(34, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, B.x, B.y + 2); }
    ctx.restore();
  }
  // a slim guide with an arrowhead, drawn from its start as p grows
  const curvePt = (x1, y1, x2, y2, s) => { const m = 1 - s; return [m ** 3 * x1 + 3 * m * m * s * (x1 + x2) / 2 + 3 * m * s * s * (x1 + x2) / 2 + s ** 3 * x2, m ** 3 * y1 + 3 * m * m * s * y1 + 3 * m * s * s * y2 + s ** 3 * y2]; };
  function guide(x1, y1, x2, y2, p, a = 1) {
    if (p <= 0 || a <= 0) return;
    const pt = s => curvePt(x1, y1, x2, y2, s);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#A9AEB5'; ctx.fillStyle = '#A9AEB5'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) { const [x, y] = pt(p * i / 30); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    if (p > 0.97) { const [xa, ya] = pt(0.96), [xb, yb] = pt(1), g = Math.atan2(yb - ya, xb - xa); ctx.beginPath(); ctx.moveTo(xb, yb); ctx.lineTo(xb - 11 * Math.cos(g - 0.42), yb - 11 * Math.sin(g - 0.42)); ctx.lineTo(xb - 11 * Math.cos(g + 0.42), yb - 11 * Math.sin(g + 0.42)); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const TILE_ORDER = [4, 0, 8, 2, 6, 1, 7, 3, 5];   // the kernel computes 2x2 tiles in parallel, the reference row by row
  function drawTests(t) {
    if (t < T.inputs || t > T.open + 1.2) return;
    const fade = 1 - ramp(t, T.testOut, 0.35);
    // which set of random inputs is showing, and how far into its trial we are
    let n = 0;
    T.trials.forEach((s, i) => { if (t >= s) n = i + 1; });
    const s0 = n ? T.trials[n - 1] : T.feed, u = n ? (t - s0) / T.trialDur : 0;
    const cur = TRIALS[n], prev = TRIALS[Math.max(0, n - 1)], swap = n ? emph(clamp(u / 0.3)) : 1;
    const A = blend(prev.A, cur.A, swap), B = blend(prev.B, cur.B, swap);

    // inputs
    if (fade > 0) {
      const flick = (r, c, at) => ramp(t, at + ((r * 7 + c * 3) % 11) * 0.025, 0.3);
      matrix(...POS.A, A, { a: fade, show: (r, c) => flick(r, c, T.inputs) });
      matrix(...POS.B, B, { a: fade, show: (r, c) => flick(r, c, T.inputs + 0.1) });
      riseLine(t, [['random inputs', K.grey]], { x: POS.A[0], y: 850, size: 30, weight: 400, align: 'center', at: T.inputs + 0.3, out: T.testOut });
    }
    // guides
    const gp = k => inOut(ramp(t, T.guides + k * 0.12, 0.5));
    const toK = [...GSTART, BOXK.x - BOXK.w / 2 - 14, BOXK.y], toR = [...GSTART, BOXR.x - BOXR.w / 2 - 14, BOXR.y];
    guide(...toK, gp(0), fade);
    guide(...toR, gp(1), fade);
    const og = fade * (1 - ramp(t, T.compare, 0.3));   // these guides leave with the outputs
    guide(BOXK.x + BOXK.w / 2 + 14, BOXK.y, POS.CK[0] - 138, POS.CK[1], inOut(ramp(t, T.build - 0.2, 0.4)), og);
    guide(BOXR.x + BOXR.w / 2 + 14, BOXR.y, POS.CR[0] - 138, POS.CR[1], inOut(ramp(t, T.build - 0.15, 0.4)), og);

    // the feed: small copies of A and B ride the guides into both boxes; later trials send quicker ones
    const fly = (p, a) => {
      if (p <= 0 || p >= 1) return;
      const fa = a * clamp(p / 0.15) * (1 - clamp((p - 0.8) / 0.2));
      [A, B].forEach((M, m) => [toK, toR].forEach(G => {
        const q = inOut(clamp((p - m * 0.12) / 0.88));
        const [x, y] = curvePt(...G, q);
        matrix(x, y + (m ? 26 : -26), M, { a: fa * (q > 0 ? 1 : 0), scale: 0.3 });
      }));
    };
    fly(ramp(t, T.feed, 0.7), fade);
    if (n) fly(clamp((u - 0.15) / 0.35), fade);

    // boxes (the kernel's box is drawn by the bundle once it opens)
    const pulse = Math.sin(Math.PI * clamp((t - T.feed - 0.5) / 0.4)) + (n ? Math.sin(Math.PI * clamp((u - 0.4) / 0.35)) : 0);
    const ba = emph(ramp(t, T.boxes, 0.5));
    box(BOXR, 'reference', ba * fade, pulse);
    if (t < T.open) box(BOXK, 'CUTLASS GEMM', ba, pulse * fade);

    // outputs: the kernel's tile by tile, the reference's row by row; then both slide together
    const cp = inOut(ramp(t, T.compare, 0.7));
    const C1 = TRIALS[0].C;
    if (cp < 1) {
      const oa = fade * (1 - ramp(cp, 0.8, 0.2));
      const tileShow = (r, c) => ramp(t, T.build + TILE_ORDER.indexOf(Math.floor(r / 2) * 3 + Math.floor(c / 2)) * 0.08, 0.25);
      const rowShow = (r, c) => ramp(t, T.build + (r * 6 + c) * 0.022, 0.2);
      matrix(lerp(POS.CK[0], POS.D[0], cp), lerp(POS.CK[1], POS.D[1], cp), C1.map((row, r) => row.map((v, c) => v + TRIALS[0].D[r][c])), { a: oa, show: tileShow });
      matrix(lerp(POS.CR[0], POS.D[0], cp), lerp(POS.CR[1], POS.D[1], cp), C1, { a: oa, show: rowShow });
    }
    // the difference map: blank, because every entry is far inside the tolerance
    if (cp > 0.75) {
      const da = fade * ramp(cp, 0.75, 0.25), Dm = n ? blend(prev.D, cur.D, swap) : TRIALS[0].D;
      matrix(...POS.D, Dm, { a: da, outline: true, color: (r, c) => mix('#FFFFFF', K.ink, Math.abs(Dm[r][c]) / 1e-2 * 8) });
    }
    // one entry up close, the tick and the count
    const va = ramp(t, T.verdict, 0.3) * fade;
    if (va > 0) {
      const [cx, cy] = cellXY(...POS.D, 6, 6, ...CALL);
      ctx.save(); ctx.globalAlpha = va; ctx.strokeStyle = K.ink; ctx.lineWidth = 2;
      ctx.strokeRect(cx - CELL / 2 - 3, cy - CELL / 2 - 3, CELL + 6, CELL + 6);
      ctx.beginPath(); ctx.moveTo(cx + CELL / 2 + 3, cy); ctx.lineTo(1648, cy); ctx.stroke(); ctx.restore();
      const shown = TRIALS[n && u > 0.85 ? n : Math.max(0, n - 1)];
      const kv = shown.C[CALL[0]][CALL[1]] + shown.D[CALL[0]][CALL[1]], rv = shown.C[CALL[0]][CALL[1]];
      ctx.save(); ctx.globalAlpha = va; ctx.textBaseline = 'alphabetic';
      ctx.font = font(36, 500); ctx.fillStyle = K.ink; ctx.fillText(fmt5(kv), 1664, cy - 6);
      ctx.font = font(36, 400); ctx.fillStyle = K.grey; ctx.fillText(fmt5(rv), 1664, cy + 40);
      ctx.font = font(28, 400); ctx.fillText('within 1e-2', 1664, cy + 82);
      ctx.restore();
      const count = n === 0 ? 1 : (u > 0.9 ? n + 1 : n);
      ctx.save(); ctx.globalAlpha = fade; tick(POS.D[0] - 44, 760, 28, ramp(t, T.verdict + 0.2, 0.3)); ctx.restore();
      ctx.save(); ctx.globalAlpha = ramp(t, T.verdict + 0.25, 0.3) * fade; ctx.font = font(44, 500); ctx.fillStyle = K.ink; ctx.fillText(`${count} / 5`, POS.D[0] - 14, 776); ctx.restore();
    }
  }
  // The kernel's box stays put while its threads run out of both sides and fan out; then it fades.
  function drawBoxOpen(t) {
    if (t < T.open || t > T.open + 1.5) return;
    const a = 1 - ramp(t, T.open + 0.55, 0.6);
    box(BOXK, 'CUTLASS GEMM', a, 0, 1);
  }

  // ---- title and labels
  function drawTitle(t) {
    riseLine(t, [['Lachesis:', K.ink], ['Lean4Kernel', K.ink]], { x: W / 2, y: 196, size: 96, weight: 600, align: 'center', at: -5, out: T.titleOut });
    // "thread 0" sits above the top thread, near the left edge
    if (t > T.label0 - 0.1 && t < T.split + 0.5) riseLine(t, [['thread 0', K.ink]], { x: 120, y: yB(0, 170, t) - 26, size: 30, weight: 500, at: T.label0, out: T.split });
  }

  // ---- the Princeton shield, small in the bottom-right corner for the whole video
  const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const PRIN = await load('../assets/logos/princeton-shield.svg');
  function drawMark() { const sh = 52, sw = sh * PRIN.naturalWidth / PRIN.naturalHeight; ctx.drawImage(PRIN, 1860 - sw, 1034 - sh / 2, sw, sh); }

  function frame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    drawCover(t);
    drawBundle(t);
    drawKernels(t);
    drawTests(t);
    drawBoxOpen(t);
    drawTitle(t);
    drawMark();
  }

  window.DUR = DUR;
  window.renderFrame = async t => { frame(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  await Promise.all([font(96, 600), font(40, 500), font(40, 400), font(36, 500), font(36, 400), font(30, 500), font(34, 500), font(34, 400), font(26, 400), font(30, 400), font(44, 500), font(28, 400)].map(f => document.fonts.load(f)));
  frame(0);
  window.__ready = true;
})();
