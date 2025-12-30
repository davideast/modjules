import { execSync } from 'child_process';

async function checkEnvironment() {
  console.log("🚀 Running Jules Pre-flight checks...");

  const requirements = [
    { env: 'JULES_API_KEY', error: 'Missing JULES_API_KEY in environment.' },
    { env: 'GITHUB_TOKEN', error: 'Missing GITHUB_TOKEN for repository access.' }
  ];

  // 1. Check Environment Variables
  requirements.forEach(req => {
    if (!process.env[req.env]) {
      console.error(`❌ ${req.error}`);
      process.exit(1);
    }
  });

  // 2. Ensure Git Identity is configured (Prevents commit failures)
  try {
    execSync('git config user.name');
  } catch {
    console.log("🔧 Configuring Git user.name...");
    execSync('git config user.name "Jules Bot"');
  }

  try {
    execSync('git config user.email');
  } catch {
    console.log("🔧 Configuring Git user.email...");
    execSync('git config user.email "jules@jules.to"');
  }

  // 3. Verify GitHub CLI or Auth
  try {
    execSync('git ls-remote origin HEAD');
    console.log("✅ Git remote access verified.");
  } catch (e) {
    console.error("❌ Cannot access remote repository. Check your GITHUB_TOKEN permissions.");
    process.exit(1);
  }

  console.log("✨ Pre-flight successful. Jules is ready to code.");
}

checkEnvironment();
