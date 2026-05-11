/**
 * Timer tool for tracking elapsed time in loops.
 *
 * Usage:
 *   node timer.js start --tag <tag>
 *   node timer.js check --tag <tag> --timeout <seconds>
 *
 * Output: JSON with tag, elapsed_seconds, timeout_seconds, remaining_seconds, expired
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const TEMP_DIR = path.join(os.tmpdir(), 'yiyue-translator-timers');

function ensureDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function getTimerFile(tag) {
  return path.join(TEMP_DIR, `timer-${tag}.json`);
}

function start(tag) {
  ensureDir();
  const data = { tag, startTime: Date.now() };
  fs.writeFileSync(getTimerFile(tag), JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ tag, action: 'started', startTime: data.startTime }));
}

function check(tag, timeout) {
  const file = getTimerFile(tag);
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ error: `Timer "${tag}" not found. Run start first.` }));
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
  const remaining = Math.max(0, timeout - elapsed);
  const expired = elapsed >= timeout;

  console.log(JSON.stringify({
    tag,
    elapsed_seconds: elapsed,
    timeout_seconds: timeout,
    remaining_seconds: remaining,
    expired,
  }));

  if (expired) {
    fs.unlinkSync(file);
  }
}

function getArg(name) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const command = process.argv[2];

if (command === 'start') {
  start(getArg('--tag') || 'default');
} else if (command === 'check') {
  const tag = getArg('--tag') || 'default';
  const timeout = parseInt(getArg('--timeout'), 10);
  if (isNaN(timeout) || timeout <= 0) {
    console.log(JSON.stringify({ error: 'Invalid --timeout. Must be a positive integer (seconds).' }));
    process.exit(1);
  }
  check(tag, timeout);
} else {
  console.log('Usage:');
  console.log('  node timer.js start --tag <tag>');
  console.log('  node timer.js check --tag <tag> --timeout <seconds>');
  process.exit(1);
}
