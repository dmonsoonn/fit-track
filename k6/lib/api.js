import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api/v1';

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function get(token, path, tags) {
  const res = http.get(`${BASE_URL}${path}`, { headers: headers(token), tags });
  check(res, { [`GET ${path} is 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  return res;
}

export function post(token, path, body, tags) {
  const res = http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: headers(token),
    tags,
  });
  check(res, { [`POST ${path} is 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  return res;
}

export function patch(token, path, body, tags) {
  const res = http.patch(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: headers(token),
    tags,
  });
  check(res, { [`PATCH ${path} is 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  return res;
}

export function del(token, path, tags) {
  const res = http.del(`${BASE_URL}${path}`, null, { headers: headers(token), tags });
  check(res, { [`DELETE ${path} is 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  return res;
}

export function parseData(res) {
  try {
    return JSON.parse(res.body).data;
  } catch (_) {
    return null;
  }
}
