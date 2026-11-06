# Bump Version Command

Bump the package version and prepare for release.

Usage:
- Stable: `/bump-version [patch|minor|major]`
- Pre-release: `/bump-version pre <alpha|beta> [prerelease|prepatch|preminor|premajor]`

## Release Process Overview

1. **This command handles**: Version bump, changelog update, git commit, and tag creation
2. **CI/CD handles**: NPM package publishing when tags are pushed to GitHub
3. **You should NEVER**: Run `npm publish` or `bun publish` manually

**IMPORTANT**: The actual npm package publishing to `@mikerob/lodgify-mcp` is handled automatically by GitHub Actions CI/CD when version tags (e.g., v0.1.11) are pushed.

**CRITICAL REQUIREMENT**: Stable releases MUST be performed from the `main` branch. Feature branches must be merged to main before running this command. Pre-releases can be created from any branch.

## Steps (Stable Release)

1. **Branch Validation** ⚠️ CRITICAL
   - Check current git branch using `git branch --show-current`
   - MUST be on `main` branch (or `master` as fallback)
   - If on any other branch (e.g., `feat/`, `feature/`, `develop`, etc.):
     - Display clear error message with current branch name
     - Abort the version bump immediately
     - Instruct user to merge their branch to main first
   - Exception: Pre-release mode can run from any branch (beta/alpha workflows)

2. **Validate Input**
   - If no argument provided, default to `patch`
   - Ensure argument is one of: `patch`, `minor`, or `major`

3. **Pre-bump Validation**
   - Run `bun check` to ensure code quality, type checking passes, build passes, and all tests pass
   - If any fail, abort the version bump

4. **Bump Version**
   - Manually update the version in package.json based on the bump type
   - Calculate new version: patch (0.1.10 → 0.1.11), minor (0.1.10 → 0.2.0), major (0.1.10 → 1.0.0)
   - Edit package.json directly to update the "version" field

5. **Analyze Changes for Changelog**
   - Use `git log --oneline` to get commits since last version tag
   - Use `git diff --name-only` and `git diff --stat` to understand scope of changes
   - Categorize changes into:
     - **Added**: New features, endpoints, capabilities
     - **Changed**: Modifications to existing functionality
     - **Fixed**: Bug fixes, issue resolutions
     - **Removed**: Deleted features or deprecated functionality
     - **Security**: Security-related improvements
     - **Technical Details**: Internal improvements, refactoring

6. **Update CHANGELOG.md**
   - Add new version entry at the top (after "## [Unreleased]" if present)
   - Use format: `## [X.X.X] - YYYY-MM-DD`
   - Add categorized changes based on git analysis
   - Move any "Unreleased" items to the new version if applicable
   - Keep the changelog following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format

7. **Git Operations**
   - Stage all changes: `git add .`
   - Commit changes: `git commit -m "chore: bump version to X.X.X"`
   - Create git tag: `git tag vX.X.X`
   - Push changes: `git push`
   - Push tags: `git push --tags`

8. **Confirmation**
   - Display the new version number
   - Show changelog entries that were added
   - Confirm git tag was created
   - Remind that CI/CD will handle npm publishing automatically
   - **DO NOT run `npm publish` or `bun publish` manually**

## Example Usage (Stable)

- `/bump-version` → patches version (0.2.7 → 0.2.8)
- `/bump-version minor` → minor bump (0.2.7 → 0.3.0)
- `/bump-version major` → major bump (0.2.7 → 1.0.0)

---

## Pre-Release (alpha/beta)

Create an npm pre-release (alpha or beta) without modifying the stable version line. This uses the dedicated GitHub Actions workflow `.github/workflows/npm-beta.yml` to compute the next version, update `package.json`, publish to npm with the appropriate tag, and create a GitHub pre-release.

Key points:
- Do not update `package.json` or create git tags locally for pre-releases.
- The workflow determines the version and handles publishing and tagging.
- Tag selection logic:
  - `develop` branch → defaults to `beta`
  - `feature/*` branch → defaults to `alpha`
  - You can override via inputs (preferred method below).

### Inputs
- `<alpha|beta>`: npm dist-tag to publish under.
- `[prerelease|prepatch|preminor|premajor]`:
  - `prerelease` → increments the pre-release number (e.g., 0.1.16-beta.2 → 0.1.16-beta.3)
  - `prepatch` → bumps base patch then starts pre-release (e.g., 0.1.16 → 0.1.17-beta.0)
  - `preminor` → bumps base minor then starts pre-release (e.g., 0.1.16 → 0.2.0-beta.0)
  - `premajor` → bumps base major then starts pre-release (e.g., 0.1.16 → 1.0.0-beta.0)

### Pre-Release Workflow
1. Validate command
   - Command format: `/bump-version pre <alpha|beta> [prerelease|prepatch|preminor|premajor]`
   - Defaults: `<beta>` and `prerelease` when omitted
   - **Note**: Pre-releases can be created from ANY branch (bypasses main branch requirement)

2. Run safety checks
   - `bun test` and `bun run build` should pass
   - Abort if checks fail

3. Trigger the pre-release workflow (preferred)
   - Use GitHub Actions workflow dispatch to run `NPM Beta Release` with inputs:
     - `prerelease`: `alpha` or `beta`
     - `version`: one of `prerelease|prepatch|preminor|premajor`
   - Recommended command (if `gh` is available and you have permissions):
     - `gh workflow run .github/workflows/npm-beta.yml --ref <branch> -f prerelease=<alpha|beta> -f version=<type>`
   - Otherwise, trigger from the Actions UI: select `NPM Beta Release` → Run workflow → choose branch and inputs.

4. Do not modify version locally
   - Do not run `npm version` for pre-releases
   - Do not create tags locally
   - Let the workflow compute the next version, update `package.json`, commit, tag, and publish

5. Monitor and verify
   - Track the workflow run in Actions; the summary shows the published version and tag
   - Verify on npm: `npm view @mikerob/lodgify-mcp@<published-version> version`
   - Install via tag: `npm install @mikerob/lodgify-mcp@alpha` or `@beta`

### Example Usage (Pre-Release)
- `/bump-version pre beta` → next `-beta.N` on current base
- `/bump-version pre beta prepatch` → bump patch then `-beta.0`
- `/bump-version pre alpha` → next `-alpha.N` on current base
- `/bump-version pre alpha preminor` → bump minor then `-alpha.0`

### Notes
- Pre-releases are for testing and early validation; they do not affect the stable line.
- The workflow creates an annotated tag `v<version>` and a GitHub pre-release automatically.
- If the package hasn’t been published before, the first publish uses the current `package.json` version.

---

## Error Handling

- **If not on main branch (stable releases)**, show error and abort immediately:
  ```text
  ❌ ERROR: Version bumps must be performed from the 'main' branch

  Current branch: feat/configurable-timeout

  To proceed with a stable release:
  1. Merge your feature branch to main:
     Option A - Via GitHub PR (recommended):
       - Create a PR and merge via GitHub
       - Then: git checkout main && git pull origin main

     Option B - Direct merge (use with caution):
       - git checkout main
       - git pull origin main
       - git merge feat/configurable-timeout

  2. Run /bump-version again from main

  Alternative: Create a pre-release from current branch:
  /bump-version pre <alpha|beta>
  ```
- If `bun check` fails, show the error and stop
- If tests fail, show the error and stop
- If build fails, show the error and stop
- If git operations fail, provide troubleshooting guidance
- If no commits since last version, warn but allow manual changelog entry
- Always verify the working directory is clean before starting
- Never attempt to publish to npm directly - this is handled by CI/CD

For pre-releases specifically:
- If workflow dispatch is not permitted, request a maintainer to run the workflow from the Actions UI.
- Avoid local version/tag creation for pre-releases to prevent conflicts with the workflow's versioning.

## Recommended Workflow

### Feature Development → Stable Release
1. **Develop on feature branch**: `git checkout -b feat/my-feature`
2. **Make changes and commit**: Regular development workflow
3. **Create PR and merge to main**: Via GitHub PR process (with code review)
4. **Checkout main and pull**: `git checkout main && git pull origin main`
5. **Run version bump**: `/bump-version [patch|minor|major]`
6. **Automated CI/CD**: Tag push triggers npm publishing

### Quick Hotfix → Stable Release
1. **Checkout main**: `git checkout main && git pull origin main`
2. **Make fix directly on main**: For critical production fixes only
3. **Commit fix**: `git add . && git commit -m "fix: critical issue"`
4. **Run version bump**: `/bump-version patch`
5. **Automated CI/CD**: Tag push triggers npm publishing

### Pre-release Testing (Any Branch)
- **Can be run from ANY branch** (develop, feature/*, etc.)
- **Use**: `/bump-version pre <alpha|beta>`
- **Does not create stable release** or git tags locally
- **Useful for**: Testing changes before merging to main
- **Published to npm with tag**: @mikerob/lodgify-mcp@alpha or @beta

### Branch Strategy Summary

```text
main              → Stable releases only (patch/minor/major)
  ↑
  └── feat/*      → Pre-releases allowed (alpha/beta)
  └── feature/*   → Pre-releases allowed (alpha/beta)
  └── develop     → Pre-releases allowed (alpha/beta)
  └── hotfix/*    → Merge to main, then release
```

## Changelog Analysis Guidelines

- **Commit Message Patterns**: Look for conventional commit prefixes (feat:, fix:, chore:, docs:, etc.)
- **File Changes**: Analyze modified files to understand impact (src/ = functionality, docs/ = documentation, tests/ = testing)
- **Git Tags**: Use `git describe --tags --abbrev=0` to find the last version tag for comparison
- **Smart Categorization**:
  - New files in src/ → "Added"
  - Bug fixes in commit messages → "Fixed"
  - Documentation updates → "Changed" or separate "Documentation" section
  - Test additions → "Technical Details"
  - Security-related changes → "Security"

## Release Checklist

Before running this command:

- ✅ **Branch Validation**: Currently on `main` branch (verify with `git branch --show-current`)
- ✅ **Changes Merged**: All feature branch changes merged to main via PR
- ✅ **Working Directory**: Clean git status (no uncommitted changes)

After running this command successfully:

1. ✅ **Local Changes Complete**:
   - package.json version updated
   - CHANGELOG.md updated with new version entry
   - Changes committed with message "chore: bump version to X.X.X"
   - Git tag vX.X.X created

2. ✅ **Remote Repository Updated**:
   - Commits pushed to GitHub
   - Tags pushed to GitHub

3. ✅ **Automated Release Process**:
   - GitHub Actions workflow triggered by new tag
   - NPM package built and published to `@mikerob/lodgify-mcp`
   - Release created on GitHub with changelog
