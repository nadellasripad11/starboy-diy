// Exports frames of promo/scene.html through headless Edge (Chrome DevTools Protocol).
//   node promo/render.js --out <dir>                  every frame + events.json
//   node promo/render.js --out <dir> --times 1.8,7    just those moments, for checking
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const outDir = path.resolve(arg('--out', path.join(__dirname, 'out', 'frames')));
const times = arg('--times', null);
const port = +arg('--port', 9333);
const profile = path.resolve(arg('--profile', path.join(outDir, '..', 'edge-profile')));

const getJSON = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { let body = ''; res.on('data', (d) => (body += d)); res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } }); })
    .on('error', reject);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const short = process.argv.includes('--short') ? '?short' : '';
  const sceneUrl = 'file:///' + path.join(__dirname, 'scene.html').replace(/\\/g, '/') + short;
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--allow-file-access-from-files', '--window-size=1080,1920', sceneUrl,
  ], { stdio: 'ignore' });

  let ws;
  try {
    let target = null;
    for (let i = 0; i < 100 && !target; i++) {
      await sleep(200);
      try { target = (await getJSON(`http://127.0.0.1:${port}/json/list`)).find((t) => t.type === 'page' && t.url.startsWith('file:')); } catch { /* not up yet */ }
    }
    if (!target) throw new Error('headless Edge did not open the scene');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const p = msg.id && pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
      return r.result.value;
    };

    for (let i = 0; i < 100; i++) {
      if (await evaluate('typeof window.PROMO !== "undefined" && typeof window.promoReady !== "undefined"')) break;
      await sleep(100);
    }
    await evaluate('window.promoReady');
    const meta = await evaluate('({ fps: PROMO.FPS, duration: PROMO.DURATION, events: PROMO.EVENTS, audio: PROMO.AUDIO })');
    fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(meta, null, 2));

    const total = Math.round(meta.duration * meta.fps);
    const frames = times ? times.split(',').map((s) => Math.min(total - 1, Math.round(parseFloat(s) * meta.fps))) : [...Array(total).keys()];
    const started = Date.now();
    for (let n = 0; n < frames.length; n++) {
      const i = frames[n];
      const data = await evaluate(`PROMO.frame(${i})`);
      const name = times ? `t${(i / meta.fps).toFixed(2)}.jpg` : `f${String(i).padStart(5, '0')}.jpg`;
      fs.writeFileSync(path.join(outDir, name), Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
      if (!times && (n % 90 === 0 || n === frames.length - 1)) {
        const secs = (Date.now() - started) / 1000;
        console.log(`frame ${n + 1}/${frames.length}  ${secs.toFixed(0)}s elapsed`);
      }
    }
    console.log(`wrote ${frames.length} frame(s) + events.json to ${outDir}`);
  } finally {
    if (ws) ws.close();
    edge.kill();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
