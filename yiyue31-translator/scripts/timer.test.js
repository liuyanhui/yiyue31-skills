/**
 * Unit tests for timer.js
 * Run: node timer.test.js
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMER_SCRIPT = path.join(__dirname, 'timer.js');
const TIMER_DATA_DIR = path.join(require('os').tmpdir(), 'yiyue-translator-timers');

function run(...args) {
  const output = execSync(`node "${TIMER_SCRIPT}" ${args.join(' ')}`, { encoding: 'utf-8' });
  return JSON.parse(output.trim());
}

function runExpectError(...args) {
  try {
    execSync(`node "${TIMER_SCRIPT}" ${args.join(' ')}`, { encoding: 'utf-8', stdio: 'pipe' });
    return null;
  } catch (e) {
    return JSON.parse(e.stdout.trim());
  }
}

function getTimerFile(tag) {
  return path.join(TIMER_DATA_DIR, `timer-${tag}.json`);
}

function cleanup(...tags) {
  for (const tag of tags) {
    const file = getTimerFile(tag);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  if (fs.existsSync(TIMER_DATA_DIR)) {
    const remaining = fs.readdirSync(TIMER_DATA_DIR);
    if (remaining.length === 0) fs.rmdirSync(TIMER_DATA_DIR);
  }
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
  }
}

// --- Tests ---

console.log('timer.js unit tests\n');

// Start command
test('start returns tag and startTime', () => {
  const result = run('start', '--tag', 't1');
  assert.strictEqual(result.tag, 't1');
  assert.strictEqual(result.action, 'started');
  assert.ok(Number.isInteger(result.startTime), 'startTime should be integer ms');
  assert.ok(result.startTime > 0, 'startTime should be positive');
  cleanup('t1');
});

test('start creates timer file on disk', () => {
  run('start', '--tag', 't2');
  const file = getTimerFile('t2');
  assert.ok(fs.existsSync(file), 'timer file should exist');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  assert.strictEqual(data.tag, 't2');
  assert.ok(data.startTime > 0);
  cleanup('t2');
});

test('start with default tag', () => {
  const result = run('start', '--tag', 'default');
  assert.strictEqual(result.tag, 'default');
  cleanup('default');
});

// Check command
test('check returns correct structure', () => {
  run('start', '--tag', 't3');
  const result = run('check', '--tag', 't3', '--timeout', '1800');
  assert.strictEqual(result.tag, 't3');
  assert.ok(Number.isInteger(result.elapsed_seconds));
  assert.strictEqual(result.timeout_seconds, 1800);
  assert.ok(Number.isInteger(result.remaining_seconds));
  assert.strictEqual(result.expired, false);
  cleanup('t3');
});

test('check elapsed time is near zero right after start', () => {
  run('start', '--tag', 't4');
  const result = run('check', '--tag', 't4', '--timeout', '1800');
  assert.ok(result.elapsed_seconds <= 2, `elapsed should be <= 2, got ${result.elapsed_seconds}`);
  assert.strictEqual(result.expired, false);
  cleanup('t4');
});

test('check remaining = timeout - elapsed', () => {
  run('start', '--tag', 't5');
  const result = run('check', '--tag', 't5', '--timeout', '1800');
  assert.strictEqual(result.remaining_seconds, 1800 - result.elapsed_seconds);
  cleanup('t5');
});

// Expired timer
test('expired returns true when timeout exceeded', () => {
  // Create a timer file with a start time 2000 seconds in the past
  const file = getTimerFile('t6');
  if (!fs.existsSync(TIMER_DATA_DIR)) fs.mkdirSync(TIMER_DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ tag: 't6', startTime: Date.now() - 2000000 }));

  const result = run('check', '--tag', 't6', '--timeout', '1800');
  assert.strictEqual(result.expired, true);
  assert.strictEqual(result.remaining_seconds, 0);
});

test('expired timer file is deleted after check', () => {
  const file = getTimerFile('t6');
  assert.ok(!fs.existsSync(file), 'expired timer file should be deleted');
});

// Error handling
test('check on non-existent timer returns error', () => {
  const result = runExpectError('check', '--tag', 'nonexistent', '--timeout', '60');
  assert.ok(result !== null, 'should exit with error');
  assert.ok(result.error.includes('not found'), `error message should mention "not found", got: ${result.error}`);
});

test('check with invalid timeout returns error', () => {
  run('start', '--tag', 't7');
  const result = runExpectError('check', '--tag', 't7', '--timeout', 'abc');
  assert.ok(result !== null, 'should exit with error');
  assert.ok(result.error.includes('Invalid'), `error message should mention "Invalid", got: ${result.error}`);
  cleanup('t7');
});

test('check with negative timeout returns error', () => {
  run('start', '--tag', 't8');
  const result = runExpectError('check', '--tag', 't8', '--timeout', '-10');
  assert.ok(result !== null, 'should exit with error');
  cleanup('t8');
});

// Concurrency / isolation
test('different tags do not interfere', () => {
  run('start', '--tag', 'tA');
  run('start', '--tag', 'tB');

  const resultA = run('check', '--tag', 'tA', '--timeout', '1800');
  const resultB = run('check', '--tag', 'tB', '--timeout', '1800');

  assert.strictEqual(resultA.tag, 'tA');
  assert.strictEqual(resultB.tag, 'tB');
  assert.ok(Math.abs(resultA.elapsed_seconds - resultB.elapsed_seconds) <= 2);
  cleanup('tA', 'tB');
});

// Overwrite
test('restart overwrites previous timer', () => {
  run('start', '--tag', 't9');
  const first = run('check', '--tag', 't9', '--timeout', '1800');

  // Start again — should reset
  run('start', '--tag', 't9');
  const second = run('check', '--tag', 't9', '--timeout', '1800');

  assert.ok(second.elapsed_seconds <= first.elapsed_seconds,
    `new timer should have elapsed <= old timer (${second.elapsed_seconds} vs ${first.elapsed_seconds})`);
  cleanup('t9');
});

// Usage
test('no arguments shows usage', () => {
  let error = null;
  try {
    execSync(`node "${TIMER_SCRIPT}"`, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    error = e;
  }
  assert.ok(error !== null, 'should exit with error code');
  assert.ok(error.stdout.includes('Usage'), 'should show usage');
});

// --- Summary ---

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
