# Check Command

Run comprehensive code quality checks and automatically fix any issues that can be auto-fixed.

## Steps

1. First, run the full check suite to identify all issues:

   ```bash
   bun run check
   ```

   This runs: lint → typecheck → format → build → test

2. If there are unfixable issues, run the full check again to verify everything passes:

   ```bash
   bun run check
   ```

4. Report the results:
   - If all checks pass initially: "✅ All checks passed!"
   - If fixes were applied: List what was fixed and confirm final status
   - If there are unfixable issues: List them with guidance on manual fixes needed

## Expected Outcomes

- **Linting**: Code style and quality issues fixed automatically where possible
- **Type checking**: TypeScript type errors identified (manual fix required)
- **Build**: Compilation issues identified (manual fix required)
- **Tests**: Test failures identified (manual fix required)

## Error Handling

If any step fails with errors that cannot be auto-fixed:

- Clearly identify which check failed
- Show the specific error messages
- Provide suggestions for manual fixes when applicable
