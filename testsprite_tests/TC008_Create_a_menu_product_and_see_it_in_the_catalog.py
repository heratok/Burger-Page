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
        
        # -> Click the 'Acceso Administrador' button to open the admin login panel.
        # Acceso Administrador button
        elem = page.get_by_role('button', name='Acceso Administrador', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'admin' into the Usuario field and 'Test0502*' into the Contraseña de Acceso field, then click the 'Acceder al Panel' button.
        # Tu nombre de usuario text field
        elem = page.get_by_placeholder('Tu nombre de usuario', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill 'admin' into the Usuario field and 'Test0502*' into the Contraseña de Acceso field, then click the 'Acceder al Panel' button.
        # Ingresá tu clave de administración... password field
        elem = page.get_by_placeholder('Ingresá tu clave de administración...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test0502*")
        
        # -> Fill 'admin' into the Usuario field and 'Test0502*' into the Contraseña de Acceso field, then click the 'Acceder al Panel' button.
        # Acceder al Panel button
        elem = page.get_by_role('button', name='Acceder al Panel', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Administrar' button for 'Autotest Restaurante 2026-09-06' to open that restaurant's admin (menu management).
        # Administrar button
        elem = page.get_by_text('Autotest Restaurante 2026-09-06', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Administrar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Menú & Carta' button in the left sidebar to open the menu management section.
        # Menú & Carta button
        elem = page.get_by_role('button', name='Menú & Carta', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Crear Producto' button to open the product creation form.
        # Crear Producto button
        elem = page.get_by_role('button', name='Crear Producto', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Nombre del Producto', 'Precio ($ COP)', and 'Descripción e Ingredientes' fields and click the 'Guardar en Menú' button to save the new product.
        # Ej. Plato Especial de la Casa text field
        elem = page.get_by_placeholder('Ej. Plato Especial de la Casa', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Autotest Producto E2E 2026-09-06 - 2")
        
        # -> Fill the 'Nombre del Producto', 'Precio ($ COP)', and 'Descripción e Ingredientes' fields and click the 'Guardar en Menú' button to save the new product.
        # number field
        elem = page.locator('xpath=/html/body/div/div/div/div/main/div/div[5]/div/form/div/div[2]/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("28000")
        
        # -> Fill the 'Nombre del Producto', 'Precio ($ COP)', and 'Descripción e Ingredientes' fields and click the 'Guardar en Menú' button to save the new product.
        # Describe los ingredientes, preparación y... text area
        elem = page.get_by_placeholder('Describe los ingredientes, preparación y acompañamientos...', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Prueba E2E \u2014 Hamburguesa de test. Ingredientes: carne, lechuga, tomate, queso y salsa especial. Para verificaci\u00f3n en cat\u00e1logo.")
        
        # -> Fill the 'Nombre del Producto', 'Precio ($ COP)', and 'Descripción e Ingredientes' fields and click the 'Guardar en Menú' button to save the new product.
        # Guardar en Menú button
        elem = page.get_by_role('button', name='Guardar en Menú', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Ver Tienda' button to open the public storefront and check that the new product appears in the public catalog.
        # Ver Tienda button
        elem = page.get_by_role('button', name='Ver Tienda Pública', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The newly created product "Autotest Producto E2E 2026-09-06 - 2" is visible in the storefront catalog.
        # Assert-outcome: passed
        # Assert: Product title is visible in the storefront product card.
        await expect(page.locator("xpath=/html/body/div[1]/div/main/div/div[2]/div[1]/div").nth(0)).to_contain_text("Autotest Producto E2E 2026-09-06 - 2", timeout=15000), "Product title is visible in the storefront product card."
        
        # --> An add-to-cart control for the product is present and its aria-label includes the product name and price.
        # Assert-outcome: passed
        # Assert: The product card has an add-to-cart control with the expected aria-label including name and price.
        await expect(page.locator("xpath=/html/body/div[1]/div/main/div/div[2]/div[1]/div").nth(0)).to_have_attribute("aria-label", "Agregar Autotest Producto E2E 2026-09-06 - 2 al carrito, $28.000", timeout=15000), "The product card has an add-to-cart control with the expected aria-label including name and price."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    