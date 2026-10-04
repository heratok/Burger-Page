import { test, expect, type Page } from '@playwright/test';

/**
 * The welcome toast shown right after an admin login must never sit on top of
 * the header actions (notably "Nueva Venta"): a click there would hit the
 * toast instead of the button. No `force: true` and no toast dismissal here.
 */
async function mockAdminBackend(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('burger_page_active_rest_v2', 'rest-burger-craft');
  });
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/users/login', (route) =>
    route.fulfill(
      json({
        success: true,
        token: 'mock-token-toast',
        user: { id: 'usr-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: 'rest-burger-craft' },
      }),
    ),
  );
  await page.route('**/api/restaurants**', (route) =>
    route.fulfill(
      json([{ id: 'rest-burger-craft', slug: 'burger-craft', name: 'Burger Craft', isActive: true, config: { name: 'Burger Craft', tagline: 'Artesanal' } }]),
    ),
  );
  for (const resource of ['products', 'additions', 'orders', 'customers', 'inventory', 'suppliers', 'tables']) {
    await page.route(`**/api/${resource}**`, (route) =>
      route.request().method() === 'GET' ? route.fulfill(json([])) : route.continue(),
    );
  }
  // Registered last: Playwright matches the most recently added route first.
  await page.route('**/api/orders/stream-token', (route) => route.fulfill({ status: 200, json: { token: 'mock-stream-token' } }));
  await page.route('**/api/orders/stream*', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }));
}

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

test.describe('Admin welcome toast does not block the "Nueva Venta" action', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await mockAdminBackend(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/admin/orders');

      await page.getByPlaceholder(/Tu nombre de usuario/i).fill('admin_craft');
      await page.locator('input[type="password"]').fill('craft');

      // Sample every frame from the login click on: Sonner slides a toast in
      // (and out) from above its resting place, so a toast that rests below
      // the header can still cross the header buttons while it animates.
      await page.evaluate(() => {
        const w = window as unknown as { __toastCoveredNuevaVenta?: boolean };
        w.__toastCoveredNuevaVenta = false;
        const sample = () => {
          const target = [...document.querySelectorAll('button[aria-label="Nueva Venta"]')].find(
            (b) => b.getBoundingClientRect().width > 0,
          );
          if (target) {
            const r = target.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (hit?.closest('[data-sonner-toast]')) w.__toastCoveredNuevaVenta = true;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });

      await page.getByRole('button', { name: /Acceder al Panel/i }).click();

      const toast = page.locator('[data-sonner-toast]', { hasText: 'Bienvenido al panel de administración' });
      await expect(toast).toBeVisible();

      const button = page.getByRole('button', { name: 'Nueva Venta' }).first();
      await expect(button).toBeVisible();

      // Sonner animates the toast in; measure once it is mounted and the layout settled.
      await expect(toast).toHaveAttribute('data-mounted', 'true');
      await page.waitForTimeout(500);

      // 0) No frame of the enter animation put the toast over the button.
      const coveredWhileAnimating = await page.evaluate(
        () => (window as unknown as { __toastCoveredNuevaVenta?: boolean }).__toastCoveredNuevaVenta,
      );
      expect(coveredWhileAnimating, 'the toast crossed "Nueva Venta" while animating in').toBe(false);

      const box = (await button.boundingBox())!;
      const toastBox = (await toast.boundingBox())!;
      expect(box).not.toBeNull();
      expect(toastBox).not.toBeNull();

      // 1) Geometric: the visible toast never intersects the button.
      const overlaps =
        box.x < toastBox.x + toastBox.width &&
        box.x + box.width > toastBox.x &&
        box.y < toastBox.y + toastBox.height &&
        box.y + box.height > toastBox.y;
      expect(overlaps, `toast ${JSON.stringify(toastBox)} covers button ${JSON.stringify(box)}`).toBe(false);

      // 2) Behavioural: a real, un-forced click right now opens the POS modal.
      await button.click({ timeout: 1000 });
      await expect(page.getByText(/Punto de Venta/i)).toBeVisible();
    });
  }
});
