# Check Command

Run comprehensive code quality checks and automatically fix any issues that can be auto-fixed.

## Steps

1. First, run the full check suite to identify & fix all issues:

   ```bash
   bun run check
   ```

   This runs: lint --fix → typecheck → format → build → test

2. Report the results:
   - If all checks pass initially: "✅ All checks passed!"
   - If fixes were applied: List what was fixed and confirm final status
   - If there are unfixable issues: List them with guidance on manual fixes needed

## Expected Outcomes

- **Linting (--fix)**: Code style and quality issues fixed automatically via Biome
- **Type checking**: TypeScript type errors identified (manual fix required)
- **Formatting**: Code formatting applied automatically via Biome
- **Build**: TypeScript compilation with strict mode + executable permissions set
- **Tests**: All Bun tests executed with pass/fail results

## Error Handling

If any step fails with errors that cannot be auto-fixed:

- Clearly identify which check failed
- Show the specific error messages
- Provide suggestions for manual fixes when applicable
