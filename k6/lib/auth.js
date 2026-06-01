import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api/v1';

export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${res.body}`);
  }
  const body = JSON.parse(res.body);
  return body.data.token;
}

export function register(payload) {
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify(payload),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 201) {
    throw new Error(`register failed for ${payload.email}: ${res.status} ${res.body}`);
  }
  const body = JSON.parse(res.body);
  return body.data;
}
