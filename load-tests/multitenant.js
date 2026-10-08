// k6 multi-tenant load test for the Burger-Page backend (local only).
// Seed first: node load-tests/seed.mjs
// Run: k6 run -e PROFILE=smoke|load|stress|breakpoint load-tests/multitenant.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const PROFILE = __ENV.PROFILE || 'smoke';
const MAX_RATE = Number(__ENV.MAX_RATE || 1500);
const CRM_TENANTS = Number(__ENV.CRM_TENANTS || 5); // bounds scrypt cost in setup()

// Must be read in the init context.
const DATA = JSON.parse(open('./data/tenants.json'));
const TENANTS = DATA.tenants;

// Zipf-like popularity: weight 1/rank, so a few hot restaurants get most traffic.
const WEIGHTS = TENANTS.map((_, i) => 1 / (i + 1));
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);
function pickTenant() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < TENANTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return TENANTS[i];
  }
  return TENANTS[0];
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const PROFILES = {
  smoke: { menu: 2, orders: 1, crm: 1, ramp: [{ duration: '3s', target: 1 }, { duration: '17s', target: 1 }] },
  load: {
    menu: 60, orders: 15, crm: 5,
    ramp: [{ duration: '30s', target: 1 }, { duration: '2m', target: 1 }, { duration: '20s', target: 0 }],
  },
  stress: {
    menu: 250, orders: 70, crm: 20,
    ramp: [{ duration: '1m', target: 0.25 }, { duration: '1m', target: 0.5 }, { duration: '1m', target: 1 }, { duration: '1m', target: 1 }, { duration: '20s', target: 0 }],
  },
};

function rampScenario(P, exec, vus) {
  return {
    executor: 'ramping-vus',
    exec,
    startVUs: 0,
    stages: P.ramp.map((s) => ({ duration: s.duration, target: Math.round(vus * s.target) })),
    gracefulRampDown: '10s',
  };
}

function buildOptions() {
  if (PROFILE === 'breakpoint') {
    // No think time: arrival rate keeps rising until thresholds abort the run.
    return {
      scenarios: {
        breakpoint: {
          executor: 'ramping-arrival-rate',
          exec: 'mixed',
          startRate: 50,
          timeUnit: '1s',
          preAllocatedVUs: 200,
          maxVUs: 1500,
          stages: [0.1, 0.25, 0.5, 0.75, 1].map((f) => ({ duration: '30s', target: Math.round(MAX_RATE * f) })),
        },
      },
      thresholds: {
        http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '10s' }],
        http_req_duration: [{ threshold: 'p(95)<1500', abortOnFail: true, delayAbortEval: '10s' }],
        'http_req_duration{kind:menu}': ['p(95)<1500'],
        'http_req_duration{kind:order}': ['p(95)<1500'],
        'http_req_duration{kind:crm}': ['p(95)<1500'],
      },
    };
  }
  const P = PROFILES[PROFILE];
  if (!P) throw new Error(`Unknown PROFILE '${PROFILE}' (smoke|load|stress|breakpoint)`);
  return {
    scenarios: {
      menu: rampScenario(P, 'browseMenu', P.menu),
      orders: rampScenario(P, 'placeOrder', P.orders),
      crm: rampScenario(P, 'crmListOrders', P.crm),
    },
    thresholds: {
      http_req_failed: ['rate<0.01'],
      'http_req_duration{kind:menu}': ['p(95)<300'],
      'http_req_duration{kind:order}': ['p(95)<800'],
      'http_req_duration{kind:crm}': ['p(95)<500'],
      'checks{kind:order}': ['rate==1'],
    },
  };
}

export const options = buildOptions();

export function setup() {
  const sessions = [];
  for (const t of TENANTS.slice(0, CRM_TENANTS)) {
    const login = http.post(`${BASE}/api/users/login`, JSON.stringify({ username: t.adminUsername, password: DATA.password }), {
      headers: { 'Content-Type': 'application/json' },
    });
    check(login, { 'login 200': (r) => r.status === 200 });
    const token = login.json('token');
    if (!token) throw new Error(`setup failed: login for ${t.adminUsername} returned ${login.status}`);
    sessions.push({ restaurantId: t.restaurantId, token });
  }
  return { sessions };
}

export function browseMenu() {
  const t = pickTenant();
  const res = http.get(`${BASE}/api/products?restaurantId=${t.slug}`, { tags: { kind: 'menu' } });
  check(res, { 'menu 200': (r) => r.status === 200 }, { kind: 'menu' });
  // The storefront also loads the additions of the restaurant.
  const add = http.get(`${BASE}/api/additions?slug=${t.slug}`, { tags: { kind: 'menu' } });
  check(add, { 'additions 200': (r) => r.status === 200 }, { kind: 'menu' });
  if (PROFILE !== 'breakpoint') sleep(Math.random() * 2 + 0.5);
}

function orderRequest() {
  const t = pickTenant();
  const nItems = 1 + Math.floor(Math.random() * 4);
  const items = [];
  for (let i = 0; i < nItems; i++) {
    const productId = pick(t.productIds);
    const linked = t.additionsByProduct[productId] || [];
    const nAdd = Math.min(linked.length, Math.floor(Math.random() * 3)); // 0..2, only additions linked to this product
    const pool = linked.slice();
    const additions = [];
    for (let a = 0; a < nAdd; a++) {
      additions.push({ additionId: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], quantity: 1 });
    }
    items.push({ productId, quantity: 1 + Math.floor(Math.random() * 3), observation: '', additions });
  }
  const body = {
    restaurantId: t.slug,
    items,
    customer: {
      name: `Load ${__VU}-${__ITER}`,
      phone: `3${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      address: 'Calle 1 #2-3',
      barrio: 'Centro',
    },
    paymentMethod: 'Efectivo',
    paymentAmount: 10000000,
    changeAmount: 0,
    comment: 'k6',
    clientOrderId: uuidv4(),
  };
  const res = http.post(`${BASE}/api/orders`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    tags: { kind: 'order' },
  });
  check(res, { 'order 201': (r) => r.status === 201 }, { kind: 'order' });
  if (res.status !== 201 && __ITER < 3) console.error(`order ${res.status}: ${res.body}`);
}

export function placeOrder() {
  orderRequest();
  if (PROFILE !== 'breakpoint') sleep(Math.random() * 3 + 1);
}

function crmRequest(data) {
  const s = pick(data.sessions);
  const res = http.get(`${BASE}/api/orders?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${s.token}` },
    tags: { kind: 'crm' },
  });
  check(res, { 'crm 200': (r) => r.status === 200 }, { kind: 'crm' });
}

export function crmListOrders(data) {
  crmRequest(data);
  if (PROFILE !== 'breakpoint') sleep(Math.random() * 2 + 1);
}

// Breakpoint mix: 70% menu, 20% orders, 10% CRM polling.
export function mixed(data) {
  const roll = Math.random();
  if (roll < 0.7) browseMenu();
  else if (roll < 0.9) orderRequest();
  else crmRequest(data);
}
