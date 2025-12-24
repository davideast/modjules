import { createGasHandler } from 'modjules/gas';

// --- CONFIGURATION ---
// Values are pulled from Project Settings > Script Properties
const props = PropertiesService.getScriptProperties();
const ENV = {
  JULES_API_KEY: props.getProperty('JULES_API_KEY'),
  JULES_CLIENT_SECRET: props.getProperty('JULES_CLIENT_SECRET'),
  // Auth Options
  PROXY_ACCESS_TOKEN: props.getProperty('PROXY_ACCESS_TOKEN'),
  FIREBASE_API_KEY: props.getProperty('FIREBASE_API_KEY'),
};

// --- STRATEGIES ---
const strategies = {
  /**
   * LEVEL 1: SHARED SECRET (Default)
   * Great for personal tools and "Hello World" testing.
   */
  sharedSecret: (token: string) => {
    if (!ENV.PROXY_ACCESS_TOKEN) {
      throw new Error(
        "Setup Error: Please set 'PROXY_ACCESS_TOKEN' in Script Properties",
      );
    }
    // Simple string comparison
    if (token === ENV.PROXY_ACCESS_TOKEN) {
      return { uid: 'admin_user', email: 'admin@proxy' };
    }
    throw new Error('Unauthorized: Invalid Secret');
  },

  /**
   * LEVEL 2: FIREBASE AUTH (Production)
   * Validates ID Tokens against Google's Identity Toolkit API.
   * Zero external dependencies (uses native UrlFetchApp).
   */
  firebase: (token: string) => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${ENV.FIREBASE_API_KEY}`;

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: token }),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase Auth Failed: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    if (!data.users || data.users.length === 0) {
      throw new Error('Invalid Token');
    }

    const user = data.users[0];
    return { uid: user.localId, email: user.email };
  },
};

// --- INITIALIZATION ---
const handler = createGasHandler({
  apiKey: ENV.JULES_API_KEY || '',
  clientSecret: ENV.JULES_CLIENT_SECRET || '', // Used to sign the Capability Token

  verify: (authToken) => {
    // AUTOMATIC OPT-IN:
    // If the user provided a Firebase Key, we use Firebase.
    if (ENV.FIREBASE_API_KEY) {
      return strategies.firebase(authToken);
    }
    // Otherwise, fallback to Shared Secret
    return strategies.sharedSecret(authToken);
  },
});

// --- GAS ENTRY POINTS ---
// These must be exposed to the global scope for Apps Script to see them.

// @ts-ignore
global.doPost = (e: GoogleAppsScript.Events.DoPost) => {
  return handler(e);
};

// Optional: Simple GET endpoint to verify deployment
// @ts-ignore
global.doGet = () => {
  return ContentService.createTextOutput('Jules Proxy is Active.');
};
