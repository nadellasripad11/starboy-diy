// Runs every check in one go.
//   node tools/test_all.js              parity + mood + seed tests
//   node tools/test_all.js --compile    also builds both sketches (needs arduino-cli
//                                       on PATH, or ARDUINO_CLI=path/to/arduino-cli)
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const FQBN = 'esp32:esp32:XIAO_ESP32C3:CDCOnBoot=cdc';

const steps = [
  { name: 'firmware ↔ website parity', cmd: process.execPath, args: [path.join(__dirname, 'check_parity.js')] },
  { name: 'mood state machine', cmd: process.execPath, args: [path.join(__dirname, 'test_mood.js')] },
  { name: 'eye seeds', cmd: process.execPath, args: [path.join(__dirname, 'test_seed.js')] },
  { name: 'demo tour', cmd: process.execPath, args: [path.join(__dirname, 'test_demo.js')] },
];

if (process.argv.includes('--compile')) {
  const cli = process.env.ARDUINO_CLI || 'arduino-cli';
  for (const sketch of ['starboy_firmware', 'hardware_test']) {
    steps.push({
      name: `compile ${sketch}`,
      cmd: cli,
      args: ['compile', '--fqbn', FQBN, path.join(root, 'firmware', sketch)],
      summary: (out) => (out.match(/Sketch uses[^\n]*/) || [''])[0],
    });
  }
}

let failed = 0;
const started = Date.now();
for (const step of steps) {
  const t0 = Date.now();
  const res = spawnSync(step.cmd, step.args, { cwd: root, encoding: 'utf8' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const ok = !res.error && res.status === 0;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const line = step.summary ? step.summary(out) : out.trim().split('\n').pop();
  console.log(`${ok ? '✓' : '✗'} ${step.name.padEnd(28)} ${secs.padStart(5)}s  ${ok ? line : ''}`);
  if (!ok) {
    failed++;
    console.log(res.error ? `    ${res.error.message}` : out.trim().split('\n').map((l) => '    ' + l).join('\n'));
  }
}

console.log(`\n${failed ? `✗ ${failed} of ${steps.length} steps failed` : `✓ all ${steps.length} steps passed`} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
