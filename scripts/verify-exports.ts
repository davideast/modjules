import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// 1. Verify File Existence
console.log('Checking build artifacts...');
const dist = path.resolve('dist');
const files = [
  'index.es.js',
  'index.d.ts',
  'browser.es.js',
  'browser.d.ts',
  'gas/index.es.js',
  'gas/index.d.ts',
];

files.forEach((file) => {
  const filePath = path.join(dist, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing artifact: ${file}`);
    process.exit(1);
  }
  console.log(`✅ Found ${file}`);
});

// 2. Verify No Leakage (String Analysis)
// We grep the browser bundle to ensure no Node.js code leaked in
console.log('\nChecking for Node.js leakage in Browser bundle...');
const browserCode = fs.readFileSync(path.join(dist, 'browser.es.js'), 'utf-8');

const forbiddenTerms = [
  'require("fs")',
  'require("node:fs")',
  'require("crypto")',
  'NodePlatform',
  'NodeFileStorage',
];

let leakageFound = false;
forbiddenTerms.forEach((term) => {
  if (browserCode.includes(term)) {
    console.error(`❌ LEAK DETECTED: Browser bundle contains '${term}'`);
    leakageFound = true;
  }
});

if (leakageFound) {
  console.error('Build failed purity check.');
  process.exit(1);
}

console.log('✅ Browser bundle is clean.');
console.log('\n🎉 Verification Complete!');
