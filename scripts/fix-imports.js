#!/usr/bin/env node

/**
 * Script to fix TypeScript imports by adding .js extensions for ES modules
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const authDir = path.join(__dirname, '..', 'src', 'auth');

// Find all TypeScript files in auth directory
const files = glob.sync(`${authDir}/**/*.ts`);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix relative imports - add .js extension
  content = content.replace(
    /from\s+['"](\.[^'"]+)(?<!\.js)(?<!\.json)['"]/g,
    (match, importPath) => {
      modified = true;
      return `from '${importPath}.js'`;
    }
  );

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Fixed imports in: ${path.relative(process.cwd(), file)}`);
  }
});

console.log('Import fix complete!');