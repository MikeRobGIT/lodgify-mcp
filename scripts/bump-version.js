#!/usr/bin/env node

/**
 * Bump Version Command
 *
 * Handles both stable releases and pre-releases for @mikerob/lodgify-mcp
 *
 * Usage:
 * - Stable: node scripts/bump-version.js [patch|minor|major]
 * - Pre-release: node scripts/bump-version.js pre <alpha|beta> [prerelease|prepatch|preminor|premajor]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

/**
 * Execute command and return output
 */
function exec(command, { capture = false, cwd = projectRoot } = {}) {
  console.log(`→ ${command}`);
  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: capture ? 'pipe' : 'inherit'
    });
    return capture ? result.trim() : '';
  } catch (error) {
    console.error(`✗ Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Read and parse package.json
 */
function readPackageJson() {
  const packagePath = join(projectRoot, 'package.json');
  return JSON.parse(readFileSync(packagePath, 'utf8'));
}

/**
 * Write package.json
 */
function writePackageJson(packageData) {
  const packagePath = join(projectRoot, 'package.json');
  writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
}

/**
 * Calculate next version based on bump type
 */
function calculateNextVersion(currentVersion, bumpType) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (bumpType) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

/**
 * Get commits since last version tag for changelog analysis
 */
function getCommitsSinceLastVersion() {
  try {
    const lastTag = exec('git describe --tags --abbrev=0', { capture: true });
    const commits = exec(`git log ${lastTag}..HEAD --oneline`, { capture: true });
    const files = exec(`git diff --name-only ${lastTag}..HEAD`, { capture: true });
    const stats = exec(`git diff --stat ${lastTag}..HEAD`, { capture: true });

    return {
      lastTag,
      commits: commits.split('\n').filter(Boolean),
      files: files.split('\n').filter(Boolean),
      stats
    };
  } catch {
    // No previous tags
    const commits = exec('git log --oneline', { capture: true });
    const files = exec('git ls-files', { capture: true });

    return {
      lastTag: null,
      commits: commits.split('\n').filter(Boolean).slice(0, 10), // Recent 10 commits
      files: files.split('\n').filter(Boolean),
      stats: 'Initial release'
    };
  }
}

/**
 * Categorize changes for changelog
 */
function categorizeChanges(commits, files) {
  const categories = {
    added: [],
    changed: [],
    fixed: [],
    removed: [],
    security: [],
    technical: []
  };

  // Analyze commit messages
  commits.forEach(commit => {
    const lower = commit.toLowerCase();

    if (lower.includes('feat:') || lower.includes('add') || lower.includes('new')) {
      categories.added.push(commit);
    } else if (lower.includes('fix:') || lower.includes('bug') || lower.includes('resolve')) {
      categories.fixed.push(commit);
    } else if (lower.includes('remove') || lower.includes('delete') || lower.includes('drop')) {
      categories.removed.push(commit);
    } else if (lower.includes('security') || lower.includes('vulnerability')) {
      categories.security.push(commit);
    } else if (lower.includes('chore:') || lower.includes('test:') || lower.includes('refactor:')) {
      categories.technical.push(commit);
    } else {
      categories.changed.push(commit);
    }
  });

  // Analyze file changes
  files.forEach(file => {
    if (file.startsWith('src/') && file.endsWith('.ts') && !file.includes('test')) {
      // New functionality files
      if (file.includes('new-') || commits.some(c => c.includes('feat:'))) {
        // Already categorized by commits
      }
    } else if (file.includes('test') || file.includes('spec')) {
      categories.technical.push(`Enhanced test coverage in ${file}`);
    } else if (file.includes('docs/') || file.endsWith('.md')) {
      categories.changed.push(`Updated documentation: ${file}`);
    }
  });

  return categories;
}

/**
 * Generate changelog entry
 */
function generateChangelogEntry(version, categories, commits) {
  const today = new Date().toISOString().split('T')[0];
  let entry = `## [${version}] - ${today}\n\n`;

  // Remove duplicates and empty entries
  Object.keys(categories).forEach(key => {
    categories[key] = [...new Set(categories[key])].filter(Boolean);
  });

  if (categories.added.length > 0) {
    entry += '### Added\n\n';
    categories.added.forEach(item => {
      entry += `- ${item.replace(/^[a-f0-9]+\s+/, '')}\n`;
    });
    entry += '\n';
  }

  if (categories.changed.length > 0) {
    entry += '### Changed\n\n';
    categories.changed.forEach(item => {
      entry += `- ${item.replace(/^[a-f0-9]+\s+/, '')}\n`;
    });
    entry += '\n';
  }

  if (categories.fixed.length > 0) {
    entry += '### Fixed\n\n';
    categories.fixed.forEach(item => {
      entry += `- ${item.replace(/^[a-f0-9]+\s+/, '')}\n`;
    });
    entry += '\n';
  }

  if (categories.removed.length > 0) {
    entry += '### Removed\n\n';
    categories.removed.forEach(item => {
      entry += `- ${item.replace(/^[a-f0-9]+\s+/, '')}\n`;
    });
    entry += '\n';
  }

  if (categories.security.length > 0) {
    entry += '### Security\n\n';
    categories.security.forEach(item => {
      entry += `- ${item.replace(/^[a-f0-9]+\s+/, '')}\n`;
    });
    entry += '\n';
  }

  if (categories.technical.length > 0) {
    entry += '### Technical Details\n\n';
    categories.technical.forEach(item => {
      entry += `- ${item.replace(/^[a-f0-9]+\s+/, '')}\n`;
    });
    entry += '\n';
  }

  // If no categorized changes, add a summary
  if (Object.values(categories).every(cat => cat.length === 0)) {
    entry += '### Changed\n\n';
    entry += `- Version bump with ${commits.length} commits since last release\n`;
    entry += '- Various improvements and maintenance updates\n\n';
  }

  return entry;
}

/**
 * Update CHANGELOG.md
 */
function updateChangelog(version, changelogEntry) {
  const changelogPath = join(projectRoot, 'CHANGELOG.md');
  const changelog = readFileSync(changelogPath, 'utf8');

  // Find the position to insert the new entry (after the header)
  const lines = changelog.split('\n');
  let insertIndex = 0;

  // Find where to insert (after main header and before first version or content)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## [') || (lines[i].startsWith('##') && lines[i].includes('Unreleased'))) {
      insertIndex = i;
      break;
    }
  }

  // If no existing versions found, insert after the header
  if (insertIndex === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Semantic Versioning')) {
        insertIndex = i + 2; // After the line and one blank line
        break;
      }
    }
  }

  // Insert the new entry
  lines.splice(insertIndex, 0, changelogEntry.trim(), '');

  writeFileSync(changelogPath, lines.join('\n'));
}

/**
 * Handle stable release
 */
function handleStableRelease(bumpType = 'patch') {
  console.log(`🚀 Starting ${bumpType} version bump...\n`);

  // Validate bump type
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error('✗ Invalid bump type. Use: patch, minor, or major');
    process.exit(1);
  }

  // Pre-bump validation
  console.log('1. Running pre-bump validation...');
  exec('bun run check');
  console.log('✓ All checks passed\n');

  // Get current version and calculate next
  const packageData = readPackageJson();
  const currentVersion = packageData.version;
  const newVersion = calculateNextVersion(currentVersion, bumpType);

  console.log(`2. Version: ${currentVersion} → ${newVersion}`);

  // Update package.json
  packageData.version = newVersion;
  writePackageJson(packageData);
  console.log('✓ Updated package.json\n');

  // Analyze changes for changelog
  console.log('3. Analyzing changes for changelog...');
  const { lastTag, commits, files, stats } = getCommitsSinceLastVersion();
  console.log(`   Found ${commits.length} commits since ${lastTag || 'start'}`);
  console.log(`   Modified ${files.length} files`);

  const categories = categorizeChanges(commits, files);
  const changelogEntry = generateChangelogEntry(newVersion, categories, commits);

  updateChangelog(newVersion, changelogEntry);
  console.log('✓ Updated CHANGELOG.md\n');

  // Git operations
  console.log('4. Creating git commit and tag...');
  exec('git add .');
  exec(`git commit -m "chore: bump version to ${newVersion}"`);
  exec(`git tag v${newVersion}`);
  console.log('✓ Created commit and tag\n');

  // Push to remote
  console.log('5. Pushing to remote...');
  exec('git push');
  exec('git push --tags');
  console.log('✓ Pushed to remote\n');

  // Success message
  console.log(`🎉 Successfully released version ${newVersion}!`);
  console.log(`   📝 Git tag: v${newVersion}`);
  console.log(`   📦 CI/CD will automatically publish to NPM`);
  console.log(`   🔗 Monitor: https://github.com/MikeRobGIT/lodgify-mcp/actions`);

  // Display changelog entry
  console.log('\n📋 Added to changelog:');
  console.log(changelogEntry);
}

/**
 * Handle pre-release
 */
function handlePreRelease(tag, versionType = 'prerelease') {
  console.log(`🧪 Starting ${tag} pre-release (${versionType})...\n`);

  // Validate inputs
  if (!['alpha', 'beta'].includes(tag)) {
    console.error('✗ Invalid pre-release tag. Use: alpha or beta');
    process.exit(1);
  }

  if (!['prerelease', 'prepatch', 'preminor', 'premajor'].includes(versionType)) {
    console.error('✗ Invalid version type. Use: prerelease, prepatch, preminor, or premajor');
    process.exit(1);
  }

  // Pre-release validation
  console.log('1. Running pre-release validation...');
  exec('bun test');
  exec('bun run build');
  console.log('✓ Tests and build passed\n');

  // Check if gh CLI is available
  let hasGhCli = false;
  try {
    exec('gh --version', { capture: true });
    hasGhCli = true;
  } catch {
    console.log('ℹ️ GitHub CLI not available, will provide manual instructions\n');
  }

  // Get current branch
  const currentBranch = exec('git branch --show-current', { capture: true });
  console.log(`2. Current branch: ${currentBranch}`);

  if (hasGhCli) {
    // Use GitHub CLI to trigger workflow
    console.log('3. Triggering pre-release workflow via GitHub CLI...');

    try {
      exec(`gh workflow run .github/workflows/npm-beta.yml --ref ${currentBranch} -f prerelease=${tag} -f version=${versionType}`);
      console.log('✓ Workflow triggered successfully\n');

      console.log(`🎉 Pre-release workflow started!`);
      console.log(`   🏷️  Tag: ${tag}`);
      console.log(`   📋 Type: ${versionType}`);
      console.log(`   🌿 Branch: ${currentBranch}`);
      console.log(`   🔗 Monitor: https://github.com/MikeRobGIT/lodgify-mcp/actions`);
      console.log(`   📦 Install: npm install @mikerob/lodgify-mcp@${tag}`);

    } catch (error) {
      console.error('✗ Failed to trigger workflow via CLI');
      console.error('   Falling back to manual instructions...\n');
      hasGhCli = false;
    }
  }

  if (!hasGhCli) {
    // Provide manual instructions
    console.log('3. Manual workflow trigger required:');
    console.log('   1. Go to: https://github.com/MikeRobGIT/lodgify-mcp/actions');
    console.log('   2. Select "NPM Beta Release" workflow');
    console.log('   3. Click "Run workflow"');
    console.log('   4. Configure inputs:');
    console.log(`      - Branch: ${currentBranch}`);
    console.log(`      - Pre-release tag: ${tag}`);
    console.log(`      - Version type: ${versionType}`);
    console.log('   5. Click "Run workflow"\n');

    console.log(`📋 Workflow configuration:`);
    console.log(`   🏷️  Tag: ${tag}`);
    console.log(`   📋 Type: ${versionType}`);
    console.log(`   🌿 Branch: ${currentBranch}`);
    console.log(`   📦 Future install: npm install @mikerob/lodgify-mcp@${tag}`);
  }

  console.log('\n⚠️  Important notes:');
  console.log('   • Do NOT modify package.json version locally for pre-releases');
  console.log('   • Do NOT create git tags locally for pre-releases');
  console.log('   • The workflow handles versioning, tagging, and publishing');
  console.log('   • Monitor the workflow progress in GitHub Actions');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Default to patch
    handleStableRelease('patch');
    return;
  }

  const [command, ...rest] = args;

  if (command === 'pre') {
    // Pre-release mode
    const [tag = 'beta', versionType = 'prerelease'] = rest;
    handlePreRelease(tag, versionType);
  } else if (['patch', 'minor', 'major'].includes(command)) {
    // Stable release
    handleStableRelease(command);
  } else {
    console.error('Usage:');
    console.error('  Stable:     node scripts/bump-version.js [patch|minor|major]');
    console.error('  Pre-release: node scripts/bump-version.js pre <alpha|beta> [prerelease|prepatch|preminor|premajor]');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/bump-version.js patch');
    console.error('  node scripts/bump-version.js pre beta');
    console.error('  node scripts/bump-version.js pre alpha prepatch');
    process.exit(1);
  }
}

// Run main function
main();