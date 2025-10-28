import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    time.sleep(5)  # Add a 5-second delay
    page.goto("http://localhost:3001")
    page.get_by_placeholder("Ask me anything...").click()
    page.get_by_placeholder("Ask me anything...").fill("Hello, world!")
    page.get_by_role("button", name="send").click()
    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
