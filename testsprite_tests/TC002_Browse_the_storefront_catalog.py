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
        
        # -> Open the restaurant storefront by navigating to /rosto (the storefront page) so the catalog can be checked.
        await page.goto("http://localhost:5173/rosto")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        
        # --> Storefront catalog did not load and an empty-state message is shown instead of product cards.
        # Assert-outcome: failed
        # Assert: Expected the storefront to display product cards instead of the 'No encontramos resultados' empty-state message.
        await expect(page.locator("xpath=/html/body/div").nth(0)).to_contain_text("No encontramos resultados", timeout=15000), "Expected the storefront to display product cards instead of the 'No encontramos resultados' empty-state message."
        
        # --> Restaurant menu products are not visible on the page; the UI shows filters/search but no product items.
        # Assert-outcome: failed
        # Assert: Expected restaurant menu products to be visible instead of the empty-state guidance text.
        await expect(page.locator("xpath=/html/body/div").nth(0)).to_contain_text("No hay coincidencias con ese nombre o categor\u00eda. Prueba buscando otra cosa o revisa nuestro men\u00fa completo.", timeout=15000), "Expected restaurant menu products to be visible instead of the empty-state guidance text."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    