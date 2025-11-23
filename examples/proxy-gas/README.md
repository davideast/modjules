# Modjules GAS Proxy

A serverless, zero-cost proxy for the Jules API running on Google Apps Script.

## 🚀 Quick Start

### 1. Setup

Run the setup in this directory:

```bash
npm install
```

### 2. Create Apps Script Project

Login to Google and create a new script:

```bash
npx clasp login
npx clasp create --type webapp --title "My Jules Proxy" --rootDir ./dist
```

_Note: Select your `dist` folder as the root if prompted, or move the created `.clasp.json` to this directory._

### 3. Configure Secrets

You need to set your API keys. You can do this via the UI (Project Settings -> Script Properties) or via CLI:

**Required:**

```bash
# 1. The Key for Google's AI API
npx clasp setting JULES_API_KEY "AIza..."

# 2. A random secret string used to sign browser tokens (generate one yourself)
npx clasp setting JULES_CLIENT_SECRET "random-string-xyz"

# 3. Your password for the proxy (Shared Secret Mode)
npx clasp setting PROXY_ACCESS_TOKEN "my-super-secret-password"
```

**Optional (Firebase Mode):**
If you add this, the proxy automatically switches to Firebase Auth verification.

```bash
npx clasp setting FIREBASE_API_KEY "AIza..."
```

### 4. Deploy

Build and push the code to Google:

```bash
npm run deploy
```

_Note: If asked to overwrite the manifest, say Yes._

### 5. Publish Web App

1.  Run `npm run open` to open the script in your browser.
2.  Click **Deploy** -> **New Deployment**.
3.  Select type: **Web app**.
4.  Execute as: **Me**.
5.  Who has access: **Anyone**.
6.  Copy the **Web App URL** (ends in `/exec`).

## Usage in Client

```typescript
import { connect } from 'modjules/browser';

const jules = connect({
  proxy: {
    url: 'https://script.google.com/.../exec',
    // Matches the PROXY_ACCESS_TOKEN you set above
    auth: async () => 'my-super-secret-password',
  },
});
```
