/**
 * FitTrack k6 load test
 *
 * Usage:
 *   k6 run --env FT_TYPE=smoke  k6/load-test.js          # 1 VU, 30 s — sanity check
 *   k6 run --env FT_TYPE=load   k6/load-test.js          # ramp to 20 VUs
 *   k6 run --env FT_TYPE=stress k6/load-test.js          # ramp to 100 VUs
 *   k6 run --env FT_TYPE=bench --env FT_VUS=50 k6/load-test.js  # fixed 50 VUs per scenario
 *
 * Benchmarks for multiple VU levels (writes reports to k6/reports/):
 *   PowerShell:  .\k6\run-benchmarks.ps1
 *   Bash:        bash k6/run-benchmarks.sh
 *
 * Prerequisites:
 *   - Backend running on localhost:8080
 *   - Admin account seeded:  go run ./cmd/seed  (inside backend/)
 *   - Override base URL:     --env BASE_URL=http://myhost/api/v1
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { authScenario } from './scenarios/auth.js';
import { trainerScenario } from './scenarios/trainer.js';
import { clientScenario } from './scenarios/client.js';
import { login, register } from './lib/auth.js';
import { del } from './lib/api.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api/v1';

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

const SMOKE_STAGES = [{ duration: '30s', target: 1 }];

const LOAD_STAGES = [
  { duration: '1m', target: 20 },
  { duration: '3m', target: 20 },
  { duration: '1m', target: 0 },
];

const STRESS_STAGES = [
  { duration: '1m', target: 50 },
  { duration: '2m', target: 100 },
  { duration: '2m', target: 100 },
  { duration: '1m', target: 0 },
];

const testType = __ENV.FT_TYPE || 'smoke';
const benchVUs = parseInt(__ENV.FT_VUS || '1', 10);
const benchDuration = __ENV.FT_DURATION || '2m';

const stageMap = { smoke: SMOKE_STAGES, load: LOAD_STAGES, stress: STRESS_STAGES };

function buildScenarios() {
  if (testType === 'bench') {
    // constant-vus: fixed number of concurrent users for the whole duration
    const base = { executor: 'constant-vus', vus: benchVUs, duration: benchDuration };
    return {
      auth_load:    { ...base, exec: 'runAuth' },
      trainer_load: { ...base, exec: 'runTrainer' },
      client_load:  { ...base, exec: 'runClient' },
    };
  }

  const stages = stageMap[testType] || SMOKE_STAGES;
  const base = { executor: 'ramping-vus', startVUs: 0, stages, gracefulRampDown: '10s' };
  return {
    auth_load:    { ...base, exec: 'runAuth' },
    trainer_load: { ...base, exec: 'runTrainer' },
    client_load:  { ...base, exec: 'runClient' },
  };
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:auth}': ['p(95)<300'],
    'http_req_duration{scenario:trainer}': ['p(95)<500'],
    'http_req_duration{scenario:client}': ['p(95)<500'],
  },
};

// ---------------------------------------------------------------------------
// Setup — runs once before VUs start; result is passed to scenario functions
// ---------------------------------------------------------------------------

export function setup() {
  const password = 'K6Test1234!';
  const ts = Date.now();
  const trainerEmail = `k6.trainer.${ts}@test.local`;
  const clientEmail = `k6.client.${ts}@test.local`;

  // 1. Login as seeded admin
  const adminToken = login('admin@fittrack.local', 'admin1234');

  // 2. Register a dedicated trainer for this test run
  const trainerUser = register({
    email: trainerEmail,
    first_name: 'K6',
    last_name: 'Trainer',
    password,
    role: 'trainer',
  });

  // 3. Get trainer's invite code
  const trainerToken = login(trainerEmail, password);
  const icRes = http.get(`${BASE_URL}/trainers/me/invite-code`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const inviteCode = JSON.parse(icRes.body).data.invite_code;

  // 4. Register a dedicated client
  const clientUser = register({
    email: clientEmail,
    first_name: 'K6',
    last_name: 'Client',
    password,
    role: 'client',
    invite_code: inviteCode,
  });
  const clientToken = login(clientEmail, password);

  // 5. Resolve client_id
  const meRes = http.get(`${BASE_URL}/clients/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const clientId = JSON.parse(meRes.body).data.client_id;

  // 6. Create an exercise for use in workouts
  const exRes = http.post(
    `${BASE_URL}/exercises`,
    JSON.stringify({ name: 'k6 Squat', description: 'load test exercise', muscle_group: 'legs' }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` } },
  );
  const exerciseId = JSON.parse(exRes.body).data.exercise_id;

  // 7. Create a workout plan for the client
  const planRes = http.post(
    `${BASE_URL}/trainer/clients/${clientId}/plans`,
    JSON.stringify({ title: 'k6 Load Test Plan', is_active: true }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` } },
  );
  const planId = JSON.parse(planRes.body).data.workout_plan_id;

  // 8. Create two workouts inside the plan
  const workoutIds = [];
  for (let i = 0; i < 2; i++) {
    const wRes = http.post(
      `${BASE_URL}/plans/${planId}/workouts`,
      JSON.stringify({
        scheduled_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
        duration_minutes: 45,
      }),
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` } },
    );
    const workout = JSON.parse(wRes.body).data;
    workoutIds.push(workout.workout_id);

    http.post(
      `${BASE_URL}/workouts/${workout.workout_id}/exercises`,
      JSON.stringify({ exercise_id: exerciseId, sets: 3, reps: 10, weight: 60, order: 1 }),
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` } },
    );
  }

  return {
    adminToken,
    trainerToken,
    clientToken,
    trainerEmail,
    clientEmail,
    password,
    clientId,
    planId,
    workoutIds,
    trainerUserId: trainerUser.user_id,
    clientUserId: clientUser.user_id,
  };
}

// ---------------------------------------------------------------------------
// Scenario exports
// ---------------------------------------------------------------------------

export function runAuth(data)    { authScenario(data); }
export function runTrainer(data) { trainerScenario(data); }
export function runClient(data)  { clientScenario(data); }

// ---------------------------------------------------------------------------
// Teardown — clean up test accounts
// ---------------------------------------------------------------------------

export function teardown(data) {
  sleep(2);
  del(data.adminToken, `/admin/users/${data.clientUserId}`);
  del(data.adminToken, `/admin/users/${data.trainerUserId}`);
}

// ---------------------------------------------------------------------------
// Summary — write human-readable + JSON report to k6/reports/
// ---------------------------------------------------------------------------

function ms(v)   { return v != null ? `${v.toFixed(1)}ms` : 'N/A'; }
function pct(v)  { return v != null ? `${(v * 100).toFixed(2)}%` : 'N/A'; }
function hr()    { return '─'.repeat(64); }

function buildTextReport(data) {
  const label = __ENV.FT_VUS ? `${__ENV.FT_VUS} VUs/scenario` : `type=${testType}`;
  const lines = [
    hr(),
    `  FitTrack Load Test Report`,
    `  ${new Date().toISOString()}   ${label}`,
    hr(),
  ];

  const m = data.metrics;

  // Overall HTTP duration
  const dur = m.http_req_duration;
  if (dur) {
    const v = dur.values;
    lines.push('');
    lines.push('  HTTP Request Duration');
    lines.push(`    avg  ${ms(v.avg)}   min  ${ms(v.min)}   max  ${ms(v.max)}`);
    lines.push(`    p50  ${ms(v.med)}   p90  ${ms(v['p(90)'])}   p95  ${ms(v['p(95)'])}   p99  ${ms(v['p(99)'])}`);
  }

  // Throughput & errors
  const reqs = m.http_reqs;
  const fail = m.http_req_failed;
  if (reqs || fail) {
    lines.push('');
    lines.push('  Throughput & Errors');
    if (reqs) lines.push(`    req/s       ${reqs.values.rate.toFixed(2)}   total ${reqs.values.count}`);
    if (fail) lines.push(`    error rate  ${pct(fail.values.rate)}`);
  }

  // Per-scenario duration breakdowns
  const scenarioKeys = Object.keys(m).filter(
    (k) => k.startsWith('http_req_duration{') && k.includes('scenario:'),
  );
  if (scenarioKeys.length > 0) {
    lines.push('');
    lines.push('  Per-scenario p95');
    for (const key of scenarioKeys) {
      const scenario = key.match(/scenario:([^}]+)/)?.[1] ?? key;
      const v = m[key].values;
      lines.push(`    ${scenario.padEnd(12)}  p95 ${ms(v['p(95)'])}   avg ${ms(v.avg)}`);
    }
  }

  // Thresholds
  if (data.thresholds) {
    const entries = Object.entries(data.thresholds);
    if (entries.length > 0) {
      lines.push('');
      lines.push('  Thresholds');
      for (const [name, result] of entries) {
        const mark = result.ok ? 'PASS' : 'FAIL';
        lines.push(`    [${mark}] ${name}`);
      }
    }
  }

  lines.push('');
  lines.push(hr());
  return lines.join('\n');
}

export function handleSummary(data) {
  const label = __ENV.FT_VUS ? `${__ENV.FT_VUS}vus` : testType;
  const base  = `k6/reports/report-${label}`;

  const txt  = buildTextReport(data);
  const json = JSON.stringify(data, null, 2);

  return {
    [`${base}.txt`]:  txt,
    [`${base}.json`]: json,
    stdout: txt + '\n',
  };
}
