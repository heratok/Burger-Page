// k6 load test for the Burger-Page backend (local only).
// Run: k6 run -e PROFILE=smoke|load|stress load-tests/backend.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const RESTAURANT = __ENV.RESTAURANT || 'burger-craft';
const USER = __ENV.ADMIN_USER || 'loadtest_admin';
const PASS = __ENV.ADMIN_PASS || 'LoadTest#2026';
const PROFILE = __ENV.PROFILE || 'smoke';

const PROFILES = {
  smoke: { menu: 2, orders: 1, crm: 1, ramp: [{ duration: '3s', target: 1 }, { duration: '17s', target: 1 }] },
  load: {
    menu: 40, orders: 10, crm: 5,
    ramp: [{ duration: '30s', target: 1 }, { duration: '2m', target: 1 }, { duration: '20s', target: 0 }],
  },
  stress: {
    menu: 200, orders: 60, crm: 20,
    ramp: [{ duration: '1m', target: 0.25 }, { duration: '1m', target: 0.5 }, { duration: '1m', target: 1 }, { duration: '1m', target: 1 }, { duration: '20s', target: 0 }],
  },
};
const P = PROFILES[PROFILE];

function scenario(exec, vus) {
  return {
    executor: 'ramping-vus',
    exec,
    startVUs: 0,
    stages: P.ramp.map((s) => ({ duration: s.duration, target: Math.round(vus * s.target) })),
    gracefulRampDown: '10s',
  };
}

export const options = {
  scenarios: {
    menu: scenario('browseMenu', P.menu),
    orders: scenario('placeOrder', P.orders),
    crm: scenario('crmListOrders', P.crm),
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:menu}': ['p(95)<300'],
    'http_req_duration{kind:order}': ['p(95)<800'],
    'http_req_duration{kind:crm}': ['p(95)<500'],
  },
};

export function setup() {
  const login = http.post(`${BASE}/api/users/login`, JSON.stringify({ username: USER, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(login, { 'login 200': (r) => r.status === 200 });
  const token = login.json('token');
  const products = http.get(`${BASE}/api/products?restaurantId=${RESTAURANT}`).json();
  const available = products.filter((p) => p.isAvailable);
  if (!token || available.length === 0) throw new Error('setup failed: no token or no available products');
  return { token, productIds: available.map((p) => p.id) };
}

export function browseMenu() {
  const res = http.get(`${BASE}/api/products?restaurantId=${RESTAURANT}`, { tags: { kind: 'menu' } });
  check(res, { 'menu 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 0.5);
}

export function placeOrder(data) {
  const productId = data.productIds[Math.floor(Math.random() * data.productIds.length)];
  const n = `${__VU}${__ITER}`;
  const body = {
    restaurantId: RESTAURANT,
    items: [{ productId, quantity: 1 + (__ITER % 3), observation: '' }],
    customer: { name: `Load ${n}`, phone: `300${String(__VU).padStart(3, '0')}${String(__ITER).padStart(4, '0')}`, address: 'Calle 1 #2-3', barrio: 'Centro' },
    paymentMethod: 'Efectivo',
    paymentAmount: 1000000,
    changeAmount: 0,
    comment: 'k6',
    clientOrderId: uuidv4(),
  };
  const res = http.post(`${BASE}/api/orders`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    tags: { kind: 'order' },
  });
  check(res, { 'order 201': (r) => r.status === 201 });
  sleep(Math.random() * 3 + 1);
}

export function crmListOrders(data) {
  const res = http.get(`${BASE}/api/orders?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { kind: 'crm' },
  });
  check(res, { 'crm 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 1);
}
