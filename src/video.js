// Lachesis promo video. renderFrame(t) draws the frame at t seconds on a 1920x1080 canvas; nothing reads a clock.
// One motif carries the piece: GPU threads are 32 black lines that run the full width of the frame and ripple
// together; Lachesis measures them with small Princeton-orange rings that slide along each line, and a measured
// stretch turns orange while its happens-before links weave in between the lines.
//   Cover: the woven orange net with the title above it. The net slides out to the left.
//   Tests: 32 threads stream in. Five random inputs drop into them from above; each time the outputs below match
//     the reference values under them, and a tick is added (the first test slow, the other four fast).
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
    unravel: 1.0, spin: 1.7, titleOut: 2.7,
    test: [3.2, 5.45, 6.0, 6.55, 7.1], testDur: [2.1, 0.5, 0.5, 0.5, 0.5], testOut: 7.8,
    retract: 8.0, gate: 8.45, label0: 8.6,
    scan1: 9.0, pulse1: 9.65, open1: 10.15, rewind: 11.4,
    scan2: 12.0, pile: 12.7,
    proof: 15.0, halt: 17.2, drain: 18.2,
    split: 18.8, names: 19.5, meas3: 20.1, meas4: 20.7, namesOut: 24.6,
    merge: 25.0, end: 30.0,
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
  const yB = (k, x, t) => YC + (k - (N - 1) / 2) * DY * swell(x, t) + ripple(x, t) + fine(x, PH[k], t);
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

  // ---- the tests: four inputs drop in above the bundle, four outputs and their references come out below
  const RT = rng(17);
  const fmt = (v, d) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const TESTS = T.test.map(() => {
    const inp = [0, 1, 2, 3].map(() => fmt((RT() * 2 - 1) * 1.9, 2));
    const out = [0, 1, 2, 3].map(() => RT() * 0.98);
    const ref = out.map(v => v + (RT() < 0.5 ? 0 : (RT() < 0.5 ? 1 : -1) * 1e-5));
    return { inp, out: out.map(v => fmt(v, 5)), ref: ref.map(v => fmt(Math.abs(v), 5)) };
  });
  const IN_X = [190, 320, 450, 580], IN_Y = 268, OUT_X = [1290, 1460, 1630, 1800], OUT_Y = 848, REF_Y = 896;

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

  // The bundle's right end: streamed in from the left, retracted to the gate, opened through it, retracted again.
  function bundleEnd(k, t) {
    let x = lerp(XL, XR, inOut(ramp(t, T.spin + SPIN[k], 1.1)));
    x = lerp(x, XG, inOut(ramp(t, T.retract + SPIN[k] * 0.4, 0.55)));
    x = lerp(x, XR, inOut(ramp(t, T.open1 + 0.15 + SPIN[k] * 0.4, 0.8)));
    x = lerp(x, XG, inOut(ramp(t, T.rewind + SPIN[k] * 0.4, 0.45)));
    return x;
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
    if (t < T.spin || t > T.split + 0.05) return;
    const pk = pick(t);
    const lw = k => pk && pk.landed && pk.last === k ? lerp(2, 4.4, pk.a) : 2;
    for (let k = 0; k < N; k++) {
      const yf = x => yB(k, x, t);
      strand(yf, XL, bundleEnd(k, t), K.ink, lw(k));
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
    // tests: one pulse per thread carries each input across the frame
    T.test.forEach((s, i) => {
      const u = (t - s) / T.testDur[i];
      if (u < 0.2 || u > 0.78) return;
      for (let k = 0; k < N; k++) {
        const p = clamp((u - 0.22 - 0.12 * OFF[k]) / 0.4);
        if (p > 0 && p < 1) { const x = lerp(0, W, inOut(p)); dot(x, yB(k, x, t), 3.6, K.ink); }
      }
    });
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
    if (t > T.spin + 1.0) return;
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

  // ---- the tests' numbers and ticks
  function drawTests(t) {
    if (t < T.test[0] || t > T.testOut + 0.5) return;
    const fade = 1 - ramp(t, T.testOut, 0.4);
    T.test.forEach((s, i) => {
      const d = T.testDur[i], u = (t - s) / d, gone = i < 4 ? clamp((t - T.test[i + 1]) / 0.12) : 0;
      if (u < 0) return;
      const show = (txt, x, y, align, color, weight, at, k, drop) => {
        const q = emph(clamp((u - at - k * 0.025) / 0.1));
        if (q <= 0) return;
        const dq = drop ? emph(clamp((u - 0.13 - k * 0.02) / 0.13)) : 0;
        ctx.save(); ctx.font = font(36, weight); ctx.textAlign = align; ctx.fillStyle = color;
        ctx.globalAlpha = q * (1 - gone) * fade * (1 - dq);
        ctx.fillText(txt, x, y + (1 - q) * 16 + dq * 70); ctx.restore();
      };
      TESTS[i].inp.forEach((v, k) => show(v, IN_X[k], IN_Y, 'right', K.ink, 400, 0, k, true));
      TESTS[i].out.forEach((v, k) => show(v, OUT_X[k], OUT_Y, 'right', K.ink, 500, 0.72, k, false));
      TESTS[i].ref.forEach((v, k) => show(v, OUT_X[k], REF_Y, 'right', K.grey, 400, 0.82, k, false));
      ctx.save(); ctx.globalAlpha = fade; tick(OUT_X[3] - 4 * 36 + i * 36 + 4, 946, 22, clamp((u - 0.9) / 0.1)); ctx.restore();
    });
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
    drawTitle(t);
    drawMark();
  }

  window.DUR = DUR;
  window.renderFrame = async t => { frame(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  await Promise.all([font(96, 600), font(40, 500), font(40, 400), font(36, 500), font(36, 400), font(30, 500)].map(f => document.fonts.load(f)));
  frame(0);
  window.__ready = true;
})();
