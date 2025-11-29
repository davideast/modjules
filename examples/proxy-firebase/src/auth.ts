import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { connect } from 'modjules';

// 1. Initialize Firebase Client
const app = initializeApp({
  apiKey: 'AIzaSyCbQc7q4XIFGUIJWVrgzwHop27TYPyhPz8',
  authDomain: 'slack-budget.firebaseapp.com',
  databaseURL: 'https://slack-budget.firebaseio.com',
  projectId: 'slack-budget',
  storageBucket: 'slack-budget.firebasestorage.app',
  messagingSenderId: '954036860282',
  appId: '1:954036860282:web:b5ad263a1457f7002092c3',
});
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// UI References
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const startSessionBtn = document.getElementById(
  'start-session-btn',
) as HTMLButtonElement;
const userInfo = document.getElementById('user-info') as HTMLDivElement;
const userEmail = document.getElementById('user-email') as HTMLParagraphElement;
const authSection = document.getElementById('auth-section') as HTMLDivElement;
const actionSection = document.getElementById(
  'action-section',
) as HTMLDivElement;
const logs = document.getElementById('logs') as HTMLPreElement;

let currentToken: string | null = null;

function log(msg: string) {
  logs.textContent = `> ${msg}\n` + logs.textContent;
}

// 2. Auth Handlers
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e: any) {
    log(`Auth Error: ${e.message}`);
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    userEmail.textContent = user.email;
    userInfo.classList.remove('hidden');
    loginBtn.classList.add('hidden');
    actionSection.classList.remove('hidden');

    // Get the ID Token (JWT)
    currentToken = await user.getIdToken();
    log(`Authenticated. Token acquired.`);
  } else {
    userInfo.classList.add('hidden');
    loginBtn.classList.remove('hidden');
    actionSection.classList.add('hidden');
    currentToken = null;
    log('Signed out.');
  }
});

// 3. Modjules Integration
startSessionBtn.addEventListener('click', async () => {
  if (!currentToken) return log('Error: No token available.');

  log('Initializing Jules Client...');

  // Initialize pointing to our LOCAL Astro proxy
  // The token is passed in the header automatically by the client
  const jules = connect({
    baseUrl: '/api/jules',
    proxy: {
      url: '/api/jules',
      auth: () => currentToken!,
    },
  });

  try {
    log('Sending Handshake to Proxy...');
    const session = await jules.session({
      prompt: 'Hello via Proxy!',
      source: {
        github: 'https://github.com/davideast/modjules',
        branch: 'main',
      },
    });

    log(`✅ Success! Session Created: ${session.id}`);
  } catch (err: any) {
    log(`❌ Proxy Error: ${err.message}`);
    console.error(err);
  }
});
