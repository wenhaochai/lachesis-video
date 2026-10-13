// Frames of video.html through the Chrome DevTools protocol, with no packages: Node 22's own
// WebSocket drives the Chromium that Playwright keeps in its cache, or the one named in CHROME.
// Serve this folder on port 8795 first (python3 -m http.server 8795).
//
//   node src/render.mjs [--workers 6] [--from 0 --to 5]   frames at 60 fps into $TMPDIR/lachesis-frames
//   node src/render.mjs --times 1,6.7,12.5                  stills/t_01.00.png ...
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PW = os.homedir() + '/Library/Caches/ms-playwright';
const CFT = fs.readdirSync(PW).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => a.slice(9) - b.slice(9)).pop();
const CHROME = process.env.CHROME || PW + '/' + CFT + '/chrome-mac-arm64/' +
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const FPS = +arg('--fps', 60), WORKERS = +arg('--workers', 5);
const PAGE = 'http://localhost:8795/src/' + arg('--page', 'video.html');
const FROM = +arg('--from', 0), TO = arg('--to', null);
const TIMES = arg('--times', null);
// Frames go outside Documents by default: a synced folder makes conflict copies of fast writes.
const OUT = path.resolve(HERE, '..', arg('--out', TIMES ? 'stills' : path.join(os.tmpdir(), 'lachesis-frames')));
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    };
    this.open = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
}

async function worker(w) {
  const port = 9360 + w;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lachesis-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run',
    '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); }
    catch { await sleep(100); }
  }
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.open;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: PAGE });
  while (!(await cdp.eval('window.__ready === true').catch(() => false))) await sleep(200);
  return { cdp, proc, profile, dur: await cdp.eval('window.DUR') };
}

async function shoot(cdp, t, file) {
  await cdp.eval(`renderFrame(${t})`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const jobs = TIMES ? TIMES.split(',').map(Number) : null;
const n = TIMES ? 1 : WORKERS;
const workers = await Promise.all([...Array(n)].map((_, w) => worker(w)));
if (jobs) {
  for (const t of jobs) await shoot(workers[0].cdp, t, path.join(OUT, `t_${t.toFixed(2).padStart(5, '0')}.png`));
} else {
  const total = Math.ceil(FPS * (TO === null ? workers[0].dur : +TO)), first = Math.round(FPS * FROM);
  let done = 0;
  await Promise.all(workers.map(async ({ cdp }, w) => {
    for (let i = first + w; i < total; i += n) {
      const file = path.join(OUT, `f_${String(i).padStart(4, '0')}.png`);
      if (!fs.existsSync(file)) await shoot(cdp, i / FPS, file);
      if (++done % 120 === 0) console.log(`${done}/${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  console.log(`${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
// Chrome gets two seconds to quit, then it is killed; its profile goes either way.
await Promise.all(workers.map(({ proc, profile }) => new Promise(done => {
  const finish = () => { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); done(); };
  if (proc.exitCode !== null) return finish();
  const timer = setTimeout(() => proc.kill('SIGKILL'), 2000);
  proc.once('exit', () => { clearTimeout(timer); finish(); });
  proc.kill();
})));
process.exit(0);
