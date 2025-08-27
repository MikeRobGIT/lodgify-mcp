# Bump Version Command

Bump the package version and update all version references. Usage: `/bump-version [patch|minor|major]`

## Steps

1. **Validate Input**
   - If no argument provided, default to `patch`
   - Ensure argument is one of: `patch`, `minor`, or `major`

2. **Pre-bump Validation**
   - Run `bun test` to ensure all tests pass
   - Run `bun run build` to ensure the project builds successfully
   - If either fails, abort the version bump

3. **Bump Version**
   - Use `npm version $ARGUMENTS --no-git-tag-version` to update package.json
   - This prevents npm from creating the git tag (we'll do it manually)

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

6. **Update Version References**
   - Read the new version from package.json
   - Update README.md to replace all version references:
     - `npm install lodgify-mcp@X.X.X` → use new version
     - `bun add lodgify-mcp@X.X.X` → use new version  
     - `yarn add lodgify-mcp@X.X.X` → use new version
     - `npx -y lodgify-mcp@X.X.X` → use new version
     - `bunx -y lodgify-mcp@X.X.X` → use new version
     - `npx -y -p lodgify-mcp@X.X.X` → use new version
   - Update CHANGELOG.md examples that reference specific versions
   - Check for any other files that might contain version references

7. **Git Operations**
   - Stage all changes: `git add .`
   - Commit changes: `git commit -m "chore: bump version to X.X.X"`
   - Create git tag: `git tag vX.X.X`
   - Push changes: `git push`
   - Push tags: `git push --tags`

8. **Confirmation**
   - Display the new version number
   - Show changelog entries that were added
   - Confirm that all references have been updated
   - Show the git tag created

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