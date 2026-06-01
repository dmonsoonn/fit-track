import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api/v1';

// Hammers the login endpoint with both trainer and client credentials.
export function authScenario(data) {
  const loginPayloads = [
    { email: data.trainerEmail, password: data.password },
    { email: data.clientEmail, password: data.password },
  ];

  for (const payload of loginPayloads) {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify(payload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'auth' },
      },
    );
    check(res, { 'login 200': (r) => r.status === 200 });
  }

  sleep(1);
}
