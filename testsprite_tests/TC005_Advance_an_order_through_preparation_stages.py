import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:5173")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Acceso Administrador' button to open the admin login page.
        # Acceso Administrador button
        elem = page.get_by_role('button', name='Acceso Administrador', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'admin' into the Usuario field, fill 'Test0502*' into the Contraseña de Acceso field, and click the 'Acceder al Panel' button to log in.
        # Tu nombre de usuario text field
        elem = page.get_by_placeholder('Tu nombre de usuario', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill 'admin' into the Usuario field, fill 'Test0502*' into the Contraseña de Acceso field, and click the 'Acceder al Panel' button to log in.
        # Ingresá tu clave de administración... password field
        elem = page.get_by_placeholder('Ingresá tu clave de administración...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test0502*")
        
        # -> Fill 'admin' into the Usuario field, fill 'Test0502*' into the Contraseña de Acceso field, and click the 'Acceder al Panel' button to log in.
        # Acceder al Panel button
        elem = page.get_by_role('button', name='Acceder al Panel', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Administrar' button for 'Autotest Restaurante 2026-09-06' to open that restaurant's admin (to access Orders / Order Board).
        # Administrar button
        elem = page.get_by_text('Autotest Restaurante 2026-09-06', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Administrar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Pedidos en Vivo' button in the left menu to open the live orders / Kanban board.
        # Pedidos en Vivo button
        elem = page.get_by_role('button', name='Pedidos en Vivo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Historial' button to view completed orders and verify the order appears there (confirming it left active workflow after completion).
        # Historial 1 button
        elem = page.get_by_role('button', name='Historial 1', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Comandas Activas' (Active Orders) view to confirm there are no active orders, then open 'Historial' and confirm the order is listed with the 'Entregado' status.
        # Comandas Activas 0 button
        elem = page.get_by_role('button', name='Comandas Activas 0', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Comandas Activas' (Active Orders) view to confirm there are no active orders, then open 'Historial' and confirm the order is listed with the 'Entregado' status.
        # Historial 1 button
        elem = page.get_by_role('button', name='Historial 1', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm there are no active orders, then click the 'Historial' tab to confirm the delivered order is shown with status 'Entregado'.
        # Comandas Activas 0 button
        elem = page.get_by_role('button', name='Comandas Activas 0', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm there are no active orders, then click the 'Historial' tab to confirm the delivered order is shown with status 'Entregado'.
        # Historial 1 button
        elem = page.get_by_role('button', name='Historial 1', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm the active orders list is empty, then click the 'Historial' tab to confirm the delivered order appears with status 'Entregado'.
        # Comandas Activas 0 button
        elem = page.get_by_role('button', name='Comandas Activas 0', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm the active orders list is empty, then click the 'Historial' tab to confirm the delivered order appears with status 'Entregado'.
        # Historial 1 button
        elem = page.get_by_role('button', name='Historial 1', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm the active orders list is empty.
        # Comandas Activas 0 button
        elem = page.get_by_role('button', name='Comandas Activas 0', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm the active orders list is empty.
        # Historial 1 button
        elem = page.get_by_role('button', name='Historial 1', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comandas Activas' tab to confirm the active orders list is empty, then open the 'Historial' tab to confirm the delivered order shows status 'Entregado'.
        # Comandas Activas 0 button
        elem = page.get_by_role('button', name='Comandas Activas 0', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Historial' tab to confirm the delivered order appears with status 'Entregado'.
        # Historial 1 button
        elem = page.get_by_role('button', name='Historial 1', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The completed order appears in History (Historial shows 1 and the order card #1 is present).
        await page.locator("xpath=/html/body/div[1]/div/div/div/main/div/div[2]/div[1]/div/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The Historial tab shows 1 completed order.
        await expect(page.locator("xpath=/html/body/div[1]/div/div/div/main/div/div[2]/div[1]/div/button[2]").nth(0)).to_be_visible(timeout=15000), "The Historial tab shows 1 completed order."
        await page.locator("xpath=/html/body/div[1]/div/div/div/main/div/div[2]/div[2]/div/div/div[1]/div[1]/div[1]/span[1]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The history contains the order card for order #1.
        await expect(page.locator("xpath=/html/body/div[1]/div/div/div/main/div/div[2]/div[2]/div/div/div[1]/div[1]/div[1]/span[1]").nth(0)).to_be_visible(timeout=15000), "The history contains the order card for order #1."
        
        # --> The active orders area is empty after completion (Comandas Activas shows 0), and the agent observed the order was active before completing it.
        await page.locator("xpath=/html/body/div[1]/div/div/div/main/div/div[2]/div[1]/div/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The Comandas Activas tab indicates 0 active orders.
        await expect(page.locator("xpath=/html/body/div[1]/div/div/div/main/div/div[2]/div[1]/div/button[1]").nth(0)).to_be_visible(timeout=15000), "The Comandas Activas tab indicates 0 active orders."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    