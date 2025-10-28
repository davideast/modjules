from playwright.sync_api import Page, expect

def verify_chat_ui(page: Page):
    """
    This test verifies that the new chat UI is rendered correctly.
    """
    # 1. Arrange: Go to the application's home page.
    page.goto("http://localhost:3001")

    # 2. Assert: Check for the main layout and key elements.
    expect(page.locator("main")).to_be_visible()
    expect(page.locator("footer")).to_be_visible()
    expect(page.locator("input[placeholder='Suggest new branches or refine steps...']")).to_be_visible()

    # Check for the dark theme
    expect(page.locator("body")).to_have_class("dark:bg-background-dark")

    # 3. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/chat-ui.png")
