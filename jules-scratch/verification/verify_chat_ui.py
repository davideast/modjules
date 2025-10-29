from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the running application
        page.goto("http://localhost:3000")

        # Wait for the main content to be visible
        main_content = page.locator("main")
        expect(main_content).to_be_visible(timeout=10000)

        # Wait for the initial agent message to appear
        agent_message = page.get_by_text("Okay, I've created the `features.md` file")
        expect(agent_message).to_be_visible(timeout=10000)

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

        browser.close()

if __name__ == "__main__":
    run_verification()