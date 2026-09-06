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
        
        # -> Open the Login page (go to the 'Entrar al Panel Admin' /login page).
        await page.goto("http://localhost:5173/login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the 'Usuario' field with 'admin' and the 'Contraseña de Acceso' field with 'Test0502*', then click the 'Acceder al Panel' button to log in.
        # Tu nombre de usuario text field
        elem = page.get_by_placeholder('Tu nombre de usuario', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill the 'Usuario' field with 'admin' and the 'Contraseña de Acceso' field with 'Test0502*', then click the 'Acceder al Panel' button to log in.
        # Ingresá tu clave de administración... password field
        elem = page.get_by_placeholder('Ingresá tu clave de administración...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test0502*")
        
        # -> Fill the 'Usuario' field with 'admin' and the 'Contraseña de Acceso' field with 'Test0502*', then click the 'Acceder al Panel' button to log in.
        # Acceder al Panel button
        elem = page.get_by_role('button', name='Acceder al Panel', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Nuevo Restaurante' button to open the create-restaurant form.
        # Nuevo Restaurante button
        elem = page.get_by_role('button', name='Nuevo Restaurante', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Nombre del Restaurante' field and the 'Slug / URL Pública' field with a unique name/slug, then click the 'Crear Restaurante' button.
        # Ej. Sushi Master Bogotá text field
        elem = page.get_by_placeholder('Ej. Sushi Master Bogotá', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Autotest Restaurante 2026-09-06 1215")
        
        # -> Fill the 'Nombre del Restaurante' field and the 'Slug / URL Pública' field with a unique name/slug, then click the 'Crear Restaurante' button.
        # sushi-master text field
        elem = page.get_by_placeholder('sushi-master', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("autotest-resto-20260906-1215")
        
        # -> Fill the 'Nombre del Restaurante' field and the 'Slug / URL Pública' field with a unique name/slug, then click the 'Crear Restaurante' button.
        # Crear Restaurante button
        elem = page.get_by_role('button', name='Crear Restaurante', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The newly created restaurant 'Autotest Restaurante 2026-09-06 1215' with slug 'autotest-resto-20260906-1215' appears in the registry.
        # Assert-outcome: passed
        # Assert: The restaurants table row contains the created restaurant name.
        await expect(page.locator("xpath=/html/body/div/div/div/div/main/div/div[2]/div[2]/table/tbody/tr[5]/td[1]").nth(0)).to_contain_text("Autotest Restaurante 2026-09-06 1215", timeout=15000), "The restaurants table row contains the created restaurant name."
        
        # --> The restaurant's status is shown as 'Operando' in the registry.
        # Assert-outcome: passed
        # Assert: The status cell text is 'Operando' for the new restaurant.
        await expect(page.locator("xpath=/html/body/div/div/div/div/main/div/div[2]/div[2]/table/tbody/tr[5]/td[2]").nth(0)).to_have_text("Operando", timeout=15000), "The status cell text is 'Operando' for the new restaurant."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    