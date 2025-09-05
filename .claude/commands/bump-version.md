# Bump Version Command

Bump the package version and prepare for release. Usage: `/bump-version [patch|minor|major]`

## Release Process Overview

1. **This command handles**: Version bump, changelog update, git commit, and tag creation
2. **CI/CD handles**: NPM package publishing when tags are pushed to GitHub
3. **You should NEVER**: Run `npm publish` or `bun publish` manually

**IMPORTANT**: The actual npm package publishing to `@mikerob/lodgify-mcp` is handled automatically by GitHub Actions CI/CD when version tags (e.g., v0.1.11) are pushed.

## Steps

1. **Validate Input**
   - If no argument provided, default to `patch`
   - Ensure argument is one of: `patch`, `minor`, or `major`

2. **Pre-bump Validation**
   - Run `bun test` to ensure all tests pass
   - Run `bun run build` to ensure the project builds successfully
   - If either fails, abort the version bump

3. **Bump Version**
   - Manually update the version in package.json based on the bump type
   - Calculate new version: patch (0.1.10 → 0.1.11), minor (0.1.10 → 0.2.0), major (0.1.10 → 1.0.0)
   - Edit package.json directly to update the "version" field

4. **Analyze Changes for Changelog**
   - Use `git log --oneline` to get commits since last version tag
   - Use `git diff --name-only` and `git diff --stat` to understand scope of changes
   - Categorize changes into:
     - **Added**: New features, endpoints, capabilities
     - **Changed**: Modifications to existing functionality
     - **Fixed**: Bug fixes, issue resolutions
     - **Removed**: Deleted features or deprecated functionality
     - **Security**: Security-related improvements
     - **Technical Details**: Internal improvements, refactoring

5. **Update CHANGELOG.md**
   - Add new version entry at the top (after "## [Unreleased]" if present)
   - Use format: `## [X.X.X] - YYYY-MM-DD`
   - Add categorized changes based on git analysis
   - Move any "Unreleased" items to the new version if applicable
   - Keep the changelog following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format

6. **Git Operations**
   - Stage all changes: `git add .`
   - Commit changes: `git commit -m "chore: bump version to X.X.X"`
   - Create git tag: `git tag vX.X.X`
   - Push changes: `git push`
   - Push tags: `git push --tags`

7. **Confirmation**
   - Display the new version number
   - Show changelog entries that were added
   - Confirm git tag was created
   - Remind that CI/CD will handle npm publishing automatically
   - **DO NOT run `npm publish` or `bun publish` manually**

## Example Usage

- `/bump-version` → patches version (0.2.7 → 0.2.8)
- `/bump-version minor` → minor bump (0.2.7 → 0.3.0)
- `/bump-version major` → major bump (0.2.7 → 1.0.0)

## Error Handling

- If tests fail, show the error and stop
- If build fails, show the error and stop
- If git operations fail, provide troubleshooting guidance
- If no commits since last version, warn but allow manual changelog entry
- Always verify the working directory is clean before starting
- Never attempt to publish to npm directly - this is handled by CI/CD

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
