import { test, expect } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../../backend');

test.describe('Rate Limiting Load & Stress Testing (JD-CONFIRMED-001)', () => {
  const backendBaseUrl = 'http://127.0.0.1:3099';
  let serverProcess: ChildProcess | undefined;

  test.beforeAll(async ({ request }) => {
    // Launch dedicated backend with strict rate limits enabled on port 3099
    serverProcess = spawn(
      process.platform === 'win32' ? 'cmd.exe' : 'npx',
      process.platform === 'win32' ? ['/c', 'npx tsx src/index.ts'] : ['tsx', 'src/index.ts'],
      {
        cwd: backendDir,
        env: {
          ...process.env,
          PORT: '3099',
          RATE_LIMIT_MAX: '50',
          STORAGE_DRIVER: 'memory',
        },
        stdio: 'pipe',
      }
    );

    // Poll until healthy
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await request.get(`${backendBaseUrl}/health`);
        if (res.ok()) {
          ready = true;
          break;
        }
      } catch {
        // retry after delay
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    if (!ready) {
      throw new Error('Dedicated rate-limiting test server failed to become ready on port 3099');
    }
  });

  test.afterAll(async () => {
    if (serverProcess?.pid) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /T /F 2>nul`);
        } catch {
          // ignore already exited
        }
      } else {
        serverProcess.kill('SIGTERM');
      }
    }
  });

  test('stress test: high concurrency and query string permutation cannot bypass login rate limiter', async ({ request }) => {
    const concurrentRequests = 30;
    const promises = Array.from({ length: concurrentRequests }, (_, i) => {
      // Alternate between query parameters, trailing slash, and mixed queries
      let url = `${backendBaseUrl}/api/users/login`;
      if (i % 3 === 0) url += `?attempt=${i}&nonce=${Date.now()}`;
      else if (i % 3 === 1) url += `/?cb=${Math.random()}`;
      else url += `?table=1&session=${i}`;

      return request.post(url, {
        data: {
          username: `attacker-${i}`,
          password: `invalid-pass-${i}`,
        },
      });
    });

    const responses = await Promise.all(promises);
    const statuses = responses.map((res) => res.status());

    // Login rate limiter is strict (loginMax is 10/min)
    const rateLimited429Count = statuses.filter((s) => s === 429).length;
    const non429Count = statuses.filter((s) => s !== 429).length;

    console.log(`[Stress Test - Login] Total: ${concurrentRequests}, Passed: ${non429Count}, Throttled (429): ${rateLimited429Count}`);

    // Verify rate limiting kicked in despite query parameter spoofing
    expect(rateLimited429Count).toBeGreaterThan(0);

    // Verify no server errors (500) occurred under concurrency
    const serverErrors = statuses.filter((s) => s >= 500);
    expect(serverErrors).toHaveLength(0);

    // Verify error response body shape for 429
    const throttledResponse = responses.find((r) => r.status() === 429);
    if (throttledResponse) {
      const body = await throttledResponse.json();
      expect(body.status).toBe(429);
      expect(body.title).toBe('Too Many Requests');
      expect(body.detail).toMatch(/rate limit exceeded/i);
    }
  });

  test('stress test: concurrent order submission burst is strictly throttled with trailing slashes & params', async ({ request }) => {
    const burstCount = 45;
    const orderPromises = Array.from({ length: burstCount }, (_, i) => {
      let url = `${backendBaseUrl}/api/orders`;
      if (i % 2 === 0) url += `/?order_id_spoof=${i}`;
      else url += `?source=mobile&v=${i}`;

      return request.post(url, {
        data: {
          restaurantId: 'rest-burger-craft',
          items: [{ productId: `p-${i}`, quantity: 1 }],
        },
      });
    });

    const responses = await Promise.all(orderPromises);
    const statuses = responses.map((res) => res.status());

    const rateLimited429 = statuses.filter((s) => s === 429).length;
    console.log(`[Stress Test - Orders] Total: ${burstCount}, Throttled (429): ${rateLimited429}`);

    // Verify order limiter throttled excessive orders (orderMax is 30/min)
    expect(rateLimited429).toBeGreaterThan(0);

    // Zero 500s under load
    const serverErrors = statuses.filter((s) => s >= 500);
    expect(serverErrors).toHaveLength(0);
  });
});
