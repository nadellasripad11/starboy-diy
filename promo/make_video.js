// Builds the promo end to end: frames -> soundtrack -> mp4.
//   node promo/make_video.js [--work <dir>] [--out <file.mp4>]
// Needs ffmpeg on PATH or FFMPEG=path/to/ffmpeg.exe.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const work = path.resolve(arg('--work', path.join(__dirname, 'out')));
const outFile = path.resolve(arg('--out', path.join(work, 'starboy-diy-promo.mp4')));
const frames = path.join(work, 'frames');
const audio = path.join(work, 'soundtrack.wav');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

function run(label, cmd, args) {
  const t0 = Date.now();
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    console.error(`✗ ${label} failed${r.error ? `: ${r.error.message}` : ` (exit ${r.status})`}`);
    process.exit(1);
  }
  console.log(`✓ ${label} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const short = process.argv.includes('--short') ? ['--short'] : [];
run('render frames', process.execPath, [path.join(__dirname, 'render.js'), '--out', frames, '--profile', path.join(work, 'edge-profile'), ...short]);
run('synthesize soundtrack', process.execPath, [path.join(__dirname, 'sfx.js'), path.join(frames, 'events.json'), audio]);

const { fps } = JSON.parse(fs.readFileSync(path.join(frames, 'events.json'), 'utf8'));
run('encode mp4', ffmpeg, [
  '-y', '-loglevel', 'error', '-stats',
  '-framerate', String(fps), '-i', path.join(frames, 'f%05d.jpg'),
  '-i', audio,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart', '-shortest',
  outFile,
]);
console.log(`\n✓ ${outFile} (${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB)`);
