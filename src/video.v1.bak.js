// Lachesis promo video. renderFrame(t) draws the frame at t seconds on a 1920x1080 canvas; nothing reads a clock.
// One motif carries the piece: GPU threads are thin black lines on white, and Lachesis measures them with small
// Princeton-orange rings that slide along each line; a measured stretch turns orange and its happens-before links weave in.
//   Cover: the woven orange net with the title above it. The net retracts into its left edge.
//   Tests: 32 threads spin out. Five random inputs flow through them; each time the output numbers match the
//     reference numbers, and a tick is added (the first test slow, the other four fast).
//   Bug: a gate (the barrier) closes on the bundle. The hardware picks one thread; when it picks thread 0 the
//     gate opens and everything flows. Rewound, it picks another thread, the gate stays shut, and work piles up.
//   Proof: rings measure every thread up to the jam and stop there; they blink and cannot pass.
//   Scale: the bundle splits into FlashAttention-3 and FlashAttention-4, whose threads are measured end to end
//     and woven orange, then merge into the net of the cover. The video ends on the net.
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
  const K = { ink: '#15171A', grey: '#8A8F96', light: '#C9CCD1', org: '#F58025' };
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
    for (let x = x0, first = true; ; x += 12) {
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
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...P[0]);
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
    unravel: 1.0, spin: 1.9, titleOut: 2.7,
    test: [3.2, 5.45, 6.0, 6.55, 7.1], testDur: [2.1, 0.5, 0.5, 0.5, 0.5], testOut: 7.8,
    retract: 8.0, gate: 8.4, label0: 8.6,
    scan1: 9.0, pulse1: 9.65, open1: 10.15, rewind: 11.4,
    scan2: 12.0, pile: 12.7,
    proof: 15.0, halt: 17.15,
    split: 18.3, names: 19.0, meas3: 19.6, meas4: 20.2, namesOut: 24.4,
    merge: 24.8, end: 30.0,
  };
  const DUR = T.end;

  // ---- the bundle: 32 threads
  const N = 32, Y0 = 400, DY = 11, XL = 300, XR = 1480, XG = 960;
  const R = rng(3);
  const PH = Array.from({ length: N }, () => R() * Math.PI * 2);
  const wave = (x, ph, t, amp = 2.2) => amp * Math.sin(0.0065 * x + ph + 0.8 * t);
  const yB = (k, x, t) => Y0 + k * DY + wave(x, PH[k], t);
  const SPIN = Array.from({ length: N }, () => R() * 0.35);
  const OFF = Array.from({ length: N }, () => R());

  // ---- the two kernels as bands of finer threads, and the net they merge into
  function band(seed, n, y0, y1, nLinks) {
    const r = rng(seed), th = [];
    for (let j = 0; j < n; j++) th.push({ j, y: lerp(y0, y1, j / (n - 1)), ph: r() * Math.PI * 2, s: r() * 0.7, d: 2.3 + r() * 0.7, parent: Math.floor(j * N / n) });
    const links = [];
    for (let i = 0; i < nLinks; i++) {
      const a = Math.floor(r() * n), off = (1 + Math.floor(r() * 4)) * (r() < 0.5 ? -1 : 1), b = clamp(a + off, 0, n - 1);
      if (a === b) continue;
      const x1 = lerp(XL + 30, XR - 90, r()), x2 = x1 + 18 + r() * 60;
      links.push({ a, b, x1, x2 });
    }
    return { n, th, links };
  }
  const B3 = band(31, 48, 330, 520, 150), B4 = band(41, 64, 630, 860, 210);
  // Final slots: the two bands interleave into one net, 112 threads between y = 340 and 860.
  const NET0 = 340, NET1 = 860;
  [...B3.th.map(h => ({ h, key: (h.j + 0.5) / B3.n })), ...B4.th.map(h => ({ h, key: (h.j + 0.5) / B4.n + 1e-4 }))]
    .sort((a, b) => a.key - b.key).forEach(({ h }, s, all) => { h.fy = lerp(NET0, NET1, s / (all.length - 1)); h.us = R() * 0.3; });

  // ---- the tests: four inputs in, four outputs out, four reference values beside them
  const RT = rng(17);
  const fmt = (v, d) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const TESTS = T.test.map(() => {
    const inp = [0, 1, 2, 3].map(() => fmt((RT() * 2 - 1) * 1.9, 2));
    const out = [0, 1, 2, 3].map(() => RT() * 0.98);
    const ref = out.map(v => v + (RT() < 0.5 ? 0 : (RT() < 0.5 ? 1 : -1) * 1e-5));
    return { inp, out: out.map(v => fmt(v, 5)), ref: ref.map(v => fmt(Math.abs(v), 5)) };
  });
  const ROWS = [470, 530, 590, 650], XIN = 255, XOUT = 1525, XREF = 1680;

  // ---- links of the bundle, woven as the rings pass in the proof
  const RL = rng(23), BLINKS = [];
  for (let i = 0; i < 70; i++) {
    const a = Math.floor(RL() * N), b = clamp(a + (1 + Math.floor(RL() * 3)) * (RL() < 0.5 ? -1 : 1), 0, N - 1);
    if (a === b) continue;
    const x1 = lerp(XL + 30, XG - 140, RL()), x2 = x1 + 20 + RL() * 50;
    BLINKS.push({ a, b, x1, x2 });
  }
  const PILE_N = 6, pileX = m => XG - 8 - m * 8;
  const RING_STOP = pileX(PILE_N - 1) - 16;
  const RS = Array.from({ length: N }, () => ({ s: T.proof + 0.1 + R() * 0.5, d: 1.35 + R() * 0.45 }));
  const ringX = (k, t) => lerp(XL, RING_STOP, inOut(ramp(t, RS[k].s, RS[k].d)));

  // The bundle's right end: spun in from the left, retracted to the gate, opened through it, retracted again.
  function bundleEnd(k, t) {
    let x = lerp(XL, XR, inOut(ramp(t, T.spin + SPIN[k], 0.9)));
    x = lerp(x, XG, inOut(ramp(t, T.retract + SPIN[k] * 0.4, 0.5)));
    x = lerp(x, XR, inOut(ramp(t, T.open1 + 0.15 + SPIN[k] * 0.4, 0.7)));
    x = lerp(x, XG, inOut(ramp(t, T.rewind + SPIN[k] * 0.4, 0.45)));
    return x;
  }
  // The hardware's pick: a black dot hops across threads and lands; first on thread 0, later on thread 13.
  const HOP1 = [17, 6, 24, 2, 11, 0], HOP2 = [5, 21, 9, 27, 3, 13], XPICK = 640;
  function pick(t) {
    const hop = (seq, at) => {
      const u = clamp((t - at) / 0.6) * (seq.length - 1), i = Math.min(Math.floor(u), seq.length - 2);
      return { k: lerp(seq[i], seq[i + 1], emph(clamp(u - i))), landed: u >= seq.length - 1, last: seq[seq.length - 1] };
    };
    if (t >= T.scan1 && t < T.rewind + 0.3) return { ...hop(HOP1, T.scan1), a: 1 - ramp(t, T.rewind, 0.3) };
    if (t >= T.scan2 && t < T.split + 0.4) return { ...hop(HOP2, T.scan2), a: (1 - ramp(t, T.split, 0.4)) * ramp(t, T.scan2, 0.15) };
    return null;
  }

  function drawBundle(t) {
    if (t < T.spin || t > T.split + 0.05) return;
    const pk = pick(t);
    const thick = k => pk && pk.landed && pk.last === k ? lerp(1.6, 3.6, pk.a) : 1.6;
    for (let k = 0; k < N; k++) {
      const yf = x => yB(k, x, t), x1 = bundleEnd(k, t);
      strand(yf, XL, x1, K.ink, thick(k));
      if (t >= T.proof) strand(yf, XL, ringX(k, t), K.org, thick(k) + 0.4);
    }
    // woven links: they appear once both rings have passed their ends
    if (t >= T.proof) BLINKS.forEach(L => {
      const a = Math.min(ramp(ringX(L.a, t), L.x1, 30), ramp(ringX(L.b, t), L.x2, 30));
      link(L.x1, yB(L.a, L.x1, t), L.x2, yB(L.b, L.x2, t), K.org, 1.3, a);
    });
    // the gate and the jam in front of it
    const gateA = ramp(t, T.gate, 0.4) * (1 - ramp(t, T.split, 0.4));
    const open = inOut(ramp(t, T.open1, 0.3)) * (1 - inOut(ramp(t, T.rewind + 0.05, 0.4)));
    if (gateA > 0) {
      const top = Y0 - 26, bot = Y0 + (N - 1) * DY + 26, mid = (top + bot) / 2, grow = emph(ramp(t, T.gate, 0.45));
      ctx.save(); ctx.globalAlpha = gateA; ctx.strokeStyle = K.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      const half = (bot - top) / 2 * grow, shift = open * 90;
      ctx.moveTo(XG, mid - half - shift); ctx.lineTo(XG, mid - shift);
      ctx.moveTo(XG, mid + shift); ctx.lineTo(XG, mid + half + shift);
      ctx.globalAlpha = gateA * (1 - open * 0.9); ctx.stroke(); ctx.restore();
    }
    // tests: one pulse per thread carries each input through
    T.test.forEach((s, i) => {
      const u = (t - s) / T.testDur[i];
      if (u < 0.2 || u > 0.75) return;
      for (let k = 0; k < N; k++) {
        const p = clamp((u - 0.22 - 0.12 * OFF[k]) / 0.36);
        if (p > 0 && p < 1) { const x = lerp(XL, XR, inOut(p)); dot(x, yB(k, x, t), 3.2, K.ink); }
      }
    });
    // pass: thread 0 carries the copy to the gate, then work flows through the open gate
    if (t >= T.pulse1 && t < T.open1 + 0.05) { const x = lerp(XPICK, XG - 6, inOut(ramp(t, T.pulse1, 0.5))); dot(x, yB(0, x, t), 4.6, K.ink); }
    if (t >= T.open1 + 0.1 && t < T.rewind) for (let k = 0; k < N; k++) {
      const p = ramp(t, T.open1 + 0.15 + OFF[k] * 0.35, 0.75);
      if (p > 0 && p < 1) { const x = lerp(XG - 40, XR, inOut(p)); dot(x, yB(k, x, t), 3.2, K.ink); }
    }
    // stuck: every thread keeps sending work, and it piles up against the gate
    if (t >= T.pile) {
      const pa = 1 - ramp(t, T.split, 0.4);
      for (let k = 0; k < N; k++) for (let m = 0; m < PILE_N; m++) {
        const e = T.pile + OFF[k] * 0.4 + m * 0.36;
        if (t < e) continue;
        const x = Math.min(XL + (t - e) * 760, pileX(m));
        dot(x, yB(k, x, t), 3.2, K.ink, pa);
      }
    }
    // the picker
    if (pk && pk.a > 0) { const y = Y0 + pk.k * DY + wave(XPICK, PH[Math.round(pk.k)], t); dot(XPICK, y, 6.5, K.ink, pk.a); }
    // Lachesis's rings: they measure each thread up to the jam, stop, and blink
    if (t >= T.proof) {
      const blink = t > T.halt ? 1 + 0.35 * Math.max(0, Math.sin((t - T.halt) * Math.PI * 2 / 0.5)) * (1 - ramp(t, T.halt + 1.0, 0.1)) : 1;
      for (let k = 0; k < N; k++) {
        const x = ringX(k, t), a = ramp(t, RS[k].s - 0.15, 0.2) * (1 - ramp(t, T.split, 0.35));
        ring(x, yB(k, x, t), 4.6 * blink, a, 1.8);
      }
    }
  }

  // ---- the two kernels, then the net
  function bandY(B, h, x, t) {
    const yParent = yB(h.parent, x, t);
    const yBand = h.y + wave(x, h.ph, t, 1.6);
    const yNet = h.fy + wave(x, h.ph, t, 1.6);
    const ps = inOut(ramp(t, T.split, 1.0)), pm = inOut(ramp(t, T.merge + h.us, 1.1));
    return lerp(lerp(yParent, yBand, ps), yNet, pm);
  }
  function front(B, h, t, at) { return lerp(XL, XR, inOut(ramp(t, at + h.s, h.d))); }
  function drawBand(B, t, at) {
    const x1 = t < T.split + 1.2 ? lerp(XG, XR, inOut(ramp(t, T.split + 0.1, 1.0))) : XR;
    B.th.forEach(h => {
      const yf = x => bandY(B, h, x, t), f = front(B, h, t, at);
      strand(yf, XL, x1, K.ink, 1.1, 1 - ramp(f, XL + 40, XR - XL - 40) * 0.0);
      // the buggy kernel's orange measurement drains as the bundle splits
      const old = 1 - ramp(t, T.split, 0.5);
      if (old > 0) strand(yf, XL, ringX(h.parent, t), K.org, 1.4, old);
      if (f > XL + 0.5) strand(yf, XL, f, K.org, 1.25);
    });
    B.links.forEach(L => {
      const ha = B.th[L.a], hb = B.th[L.b];
      const a = Math.min(ramp(front(B, ha, t, at), L.x1, 30), ramp(front(B, hb, t, at), L.x2, 30));
      link(L.x1, bandY(B, ha, L.x1, t), L.x2, bandY(B, hb, L.x2, t), K.org, 0.9, a * 0.85);
    });
    // rings ride the fronts of every fourth thread while it is being measured
    B.th.forEach(h => {
      if (h.j % 4) return;
      const p = ramp(t, at + h.s, h.d);
      if (p <= 0 || p >= 1) return;
      const f = front(B, h, t, at);
      ring(f, bandY(B, h, f, t), 3.6, ramp(p, 0, 0.05) * (1 - ramp(p, 0.92, 0.08)), 1.5);
    });
  }
  function drawKernels(t) {
    if (t < T.split) return;
    drawBand(B3, t, T.meas3);
    drawBand(B4, t, T.meas4);
    riseLine(t, [['FlashAttention-3', K.ink]], { x: XL, y: 300, size: 32, weight: 500, at: T.names, out: T.namesOut });
    riseLine(t, [['512 threads', K.grey]], { x: XL + textW('FlashAttention-3', 32, 500) + 24, y: 300, size: 32, weight: 400, at: T.names + 0.25, out: T.namesOut });
    riseLine(t, [['FlashAttention-4', K.ink]], { x: XL, y: 604, size: 32, weight: 500, at: T.names + 0.15, out: T.namesOut });
    riseLine(t, [['714,000 events', K.grey]], { x: XL + textW('FlashAttention-4', 32, 500) + 24, y: 604, size: 32, weight: 400, at: T.names + 0.4, out: T.namesOut });
  }

  // ---- the cover: the finished net, which retracts into its left edge
  function drawCover(t) {
    if (t > T.spin + 0.2) return;
    const all = [...B3.th.map(h => [B3, h]), ...B4.th.map(h => [B4, h])];
    const la = 1 - ramp(t, T.unravel, 0.35);
    [B3, B4].forEach(B => B.links.forEach(L => {
      const ha = B.th[L.a], hb = B.th[L.b];
      link(L.x1, ha.fy + wave(L.x1, ha.ph, t, 1.6), L.x2, hb.fy + wave(L.x2, hb.ph, t, 1.6), K.org, 0.9, 0.85 * la);
    }));
    all.forEach(([B, h]) => {
      const x1 = lerp(XR, XL, inOut(ramp(t, T.unravel + h.us * 1.2, 0.6)));
      strand(x => h.fy + wave(x, h.ph, t, 1.6), XL, x1, K.org, 1.25);
    });
  }

  // ---- the tests' numbers and ticks
  function drawTests(t) {
    if (t < T.test[0] || t > T.testOut + 0.5) return;
    const fade = 1 - ramp(t, T.testOut, 0.4);
    T.test.forEach((s, i) => {
      const d = T.testDur[i], u = (t - s) / d, next = i < 4 ? (t - T.test[i + 1]) / 0.12 : -1;
      if (u < 0) return;
      const gone = clamp(next) ;
      const col = (vals, x, align, color, weight, at, slide) => vals.forEach((v, r) => {
        const q = emph(clamp((u - at - r * 0.02) / 0.1));
        if (q <= 0) return;
        ctx.save(); ctx.font = font(30, weight); ctx.textAlign = align; ctx.fillStyle = color;
        ctx.globalAlpha = q * (1 - gone) * fade * (slide ? 1 - clamp((u - 0.16) / 0.1) : 1);
        ctx.fillText(v, x + (slide ? emph(clamp((u - 0.12) / 0.14)) * 40 : 0), ROWS[r] + 10 + (1 - q) * 14);
        ctx.restore();
      });
      col(TESTS[i].inp, XIN, 'right', K.ink, 400, 0, true);
      col(TESTS[i].out, XOUT, 'left', K.ink, 500, 0.72, false);
      col(TESTS[i].ref, XREF, 'left', K.grey, 400, 0.82, false);
      ctx.save(); ctx.globalAlpha = fade; tick(XOUT + 10 + i * 34, 724, 20, clamp((u - 0.9) / 0.1)); ctx.restore();
    });
  }

  // ---- title and labels
  function drawTitle(t) {
    riseLine(t, [['Lachesis:', K.ink], ['Lean4Kernel', K.ink]], { x: W / 2, y: 250, size: 96, weight: 600, align: 'center', at: -5, out: T.titleOut });
    riseLine(t, [['thread 0', K.ink]], { x: XL - 18, y: Y0 + 9, size: 26, weight: 500, align: 'right', at: T.label0, out: T.split });
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
  await Promise.all([font(96, 600), font(32, 500), font(32, 400), font(30, 500), font(30, 400), font(26, 500)].map(f => document.fonts.load(f)));
  frame(0);
  window.__ready = true;
})();
