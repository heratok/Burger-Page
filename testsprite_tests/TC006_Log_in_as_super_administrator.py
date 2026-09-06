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
        
        # -> Open the 'Acceso Administrador' admin page (navigate to the admin sign-in at /admin).
        await page.goto("http://localhost:5173/admin")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the 'Usuario' field with 'admin', fill the 'Contraseña de Acceso' field with 'Test0502*', then click the 'Acceder al Panel' button.
        # Tu nombre de usuario text field
        elem = page.get_by_placeholder('Tu nombre de usuario', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill the 'Usuario' field with 'admin', fill the 'Contraseña de Acceso' field with 'Test0502*', then click the 'Acceder al Panel' button.
        # Ingresá tu clave de administración... password field
        elem = page.get_by_placeholder('Ingresá tu clave de administración...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test0502*")
        
        # -> Fill the 'Usuario' field with 'admin', fill the 'Contraseña de Acceso' field with 'Test0502*', then click the 'Acceder al Panel' button.
        # Acceder al Panel button
        elem = page.get_by_role('button', name='Acceder al Panel', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Browser reached the restaurant registry URL (/admin/restaurants).
        # Assert-outcome: passed
        # Assert: URL contains /admin/restaurants.
        await expect(page).to_have_url(re.compile("/admin/restaurants"), timeout=15000), "URL contains /admin/restaurants."
        
        # --> The restaurants table header is visible on the page.
        # Assert-outcome: passed
        # Assert: The restaurants table header is present with expected column labels.
        await expect(page.locator("xpath=/html/body/div/div/div/div/main/div/div[2]/div[2]/table/thead/tr").nth(0)).to_have_text("Restaurante & Slug\nEstado\nCat\u00e1logo\nVentas Acumuladas\nPedidos", timeout=15000), "The restaurants table header is present with expected column labels."
        
        # --> The restaurants table lists entries including 'rosto' and 'Test Resto 2026-09-06 1145'.
        # Assert-outcome: passed
        # Assert: First table row contains the restaurant name 'rosto'.
        await expect(page.locator("xpath=/html/body/div/div/div/div/main/div/div[2]/div[2]/table/tbody/tr[1]/td[1]").nth(0)).to_contain_text("rosto", timeout=15000), "First table row contains the restaurant name 'rosto'."
        # Assert-outcome: passed
        # Assert: Fourth table row contains the restaurant name 'Test Resto 2026-09-06 1145'.
        await expect(page.locator("xpath=/html/body/div/div/div/div/main/div/div[2]/div[2]/table/tbody/tr[4]/td[1]").nth(0)).to_contain_text("Test Resto 2026-09-06 1145", timeout=15000), "Fourth table row contains the restaurant name 'Test Resto 2026-09-06 1145'."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    