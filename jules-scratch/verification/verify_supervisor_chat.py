from playwright.sync_api import sync_playwright, Page, expect

def run(page: Page):
    """
    This script verifies the new 'Chat with Supervisor' UI.
    It enters a prompt, submits it, and waits for a response.
    """
    # 1. Navigate to the app
    page.goto("http://localhost:3000")

    # 2. Find the input and send a message
    prompt_input = page.get_by_placeholder("Ask the supervisor to do something...")
    prompt_input.fill("Hello, supervisor! Please tell me about the julets library.")

    send_button = page.get_by_role("button", name="Send")
    send_button.click()

    # 3. Wait for the agent's response to appear and contain some text.
    # We'll look for the agent's message container and expect it to have some text.
    # This is a good way to ensure the streaming has started.
    agent_message = page.locator('.bg-gray-200').last
    expect(agent_message).to_contain_text("julets", timeout=30000) # Increased timeout for Genkit

    # 4. Take a screenshot
    page.screenshot(path="jules-scratch/verification/supervisor_chat.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run(page)
        browser.close()

if __name__ == "__main__":
    main()
