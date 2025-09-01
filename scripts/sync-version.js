#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read package.json to get current version
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;

// Read README.md
const readmePath = join(rootDir, 'README.md');
let readme = readFileSync(readmePath, 'utf8');

// Update npm badge URL with specific version
readme = readme.replace(
  /\[!\[npm version\]\(https:\/\/badge\.fury\.io\/js\/%40mikerob%2Flodgify-mcp\.svg\)\]/g,
  `[![npm version](https://badge.fury.io/js/%40mikerob%2Flodgify-mcp.svg)](https://www.npmjs.com/package/@mikerob/lodgify-mcp)`
);

// Update any versioned npm install commands (if you add them in the future)
// Example: npm install lodgify-mcp@0.2.6 -> npm install lodgify-mcp@0.2.7
readme = readme.replace(
  /npm install @mikerob\/lodgify-mcp@[\d\.]+/g,
  `npm install @mikerob/lodgify-mcp@${version}`
);

readme = readme.replace(
  /bun add @mikerob\/lodgify-mcp@[\d\.]+/g,
  `bun add @mikerob/lodgify-mcp@${version}`
);

readme = readme.replace(
  /yarn add @mikerob\/lodgify-mcp@[\d\.]+/g,
  `yarn add @mikerob/lodgify-mcp@${version}`
);

// Update any npx commands with specific versions (if present)
readme = readme.replace(
  /npx -y @mikerob\/lodgify-mcp@[\d\.]+/g,
  `npx -y @mikerob/lodgify-mcp@${version}`
);

readme = readme.replace(
  /bunx -y @mikerob\/lodgify-mcp@[\d\.]+/g,
  `bunx -y @mikerob/lodgify-mcp@${version}`
);

// Write updated README
writeFileSync(readmePath, readme);

console.log(`✅ Updated README.md to version ${version}`);