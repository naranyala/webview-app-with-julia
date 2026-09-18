import { healthLabel, resolveHealth } from './src/backend-health.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check(
  'browser offline wins',
  resolveHealth({ online: false, status: { status: 'ok' }, error: '' })
    .state === 'offline'
);
check(
  'probe error means unavailable',
  resolveHealth({ online: true, status: null, error: 'Timed out' }).state ===
    'unavailable'
);
check(
  'error detail passes through',
  resolveHealth({ online: true, status: null, error: 'Timed out' }).detail ===
    'Timed out'
);
check(
  'ok status connects',
  resolveHealth({ online: true, status: { status: 'ok' }, error: '' })
    .state === 'ok'
);
check(
  'non-ok status degrades',
  resolveHealth({ online: true, status: { status: 'degraded' }, error: '' })
    .state === 'degraded'
);
check(
  'missing status is unknown',
  resolveHealth({ online: true, status: null, error: '' }).state === 'unknown'
);
check('label connected', healthLabel('ok') === 'Connected');
check('label degraded', healthLabel('degraded') === 'Degraded');
check('label unavailable', healthLabel('unavailable') === 'Unavailable');
check('label offline', healthLabel('offline') === 'Offline');
check('label unknown', healthLabel('unknown') === 'Checking…');

if (failures > 0) process.exit(1);
console.log('backend health: all tests passed');
