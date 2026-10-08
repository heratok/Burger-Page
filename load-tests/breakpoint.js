// k6 breakpoint test: no think time, arrival rate keeps rising until thresholds abort the run.
// Run: k6 run load-tests/breakpoint.js   (local only)
import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const RESTAURANT = __ENV.RESTAURANT || 'burger-craft';
const USER = __ENV.ADMIN_USER || 'loadtest_admin';
const PASS = __ENV.ADMIN_PASS || 'LoadTest#2026';
const MAX_RATE = Number(__ENV.MAX_RATE || 1500);

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1500,
      stages: [
        { duration: '30s', target: Math.round(MAX_RATE * 0.1) },
        { duration: '30s', target: Math.round(MAX_RATE * 0.25) },
        { duration: '30s', target: Math.round(MAX_RATE * 0.5) },
        { duration: '30s', target: Math.round(MAX_RATE * 0.75) },
        { duration: '30s', target: MAX_RATE },
      ],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '10s' }],
    http_req_duration: [{ threshold: 'p(95)<1500', abortOnFail: true, delayAbortEval: '10s' }],
  },
};

export function setup() {
  const login = http.post(`${BASE}/api/users/login`, JSON.stringify({ username: USER, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
  });
  const token = login.json('token');
  const products = http.get(`${BASE}/api/products?restaurantId=${RESTAURANT}`).json();
  const ids = products.filter((p) => p.isAvailable).map((p) => p.id);
  if (!token || ids.length === 0) throw new Error('setup failed');
  return { token, ids };
}

export default function (data) {
  const roll = Math.random();
  if (roll < 0.7) {
    const res = http.get(`${BASE}/api/products?restaurantId=${RESTAURANT}`, { tags: { kind: 'menu' } });
    check(res, { 'menu 200': (r) => r.status === 200 });
  } else if (roll < 0.9) {
    const body = {
      restaurantId: RESTAURANT,
      items: [{ productId: data.ids[Math.floor(Math.random() * data.ids.length)], quantity: 1 }],
      customer: { name: 'Load', phone: `3${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, address: 'Calle 1 #2-3', barrio: 'Centro' },
      paymentMethod: 'Efectivo',
      paymentAmount: 1000000,
      changeAmount: 0,
      clientOrderId: uuidv4(),
    };
    const res = http.post(`${BASE}/api/orders`, JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
      tags: { kind: 'order' },
    });
    check(res, { 'order 201': (r) => r.status === 201 });
  } else {
    const res = http.get(`${BASE}/api/orders?page=1&limit=50`, {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { kind: 'crm' },
    });
    check(res, { 'crm 200': (r) => r.status === 200 });
  }
}
