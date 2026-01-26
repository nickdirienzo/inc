# CI Workflows

This directory contains GitHub Actions workflows for continuous integration.

## Workflows

### CI (`ci.yml`)

Runs on every push to `main` and on all pull requests.

**Checks:**
- TypeScript type checking (`tsc --noEmit`)
- Build verification (`npm run build`)

**Requirements:**
- Node.js 22.x
- All dependencies from package.json

## Testing CI Locally

To test the checks that CI runs, use these commands locally:

```bash
# Install dependencies
npm ci

# Run type checking
npx tsc --noEmit

# Run build
npm run build
```

## Manual Post-Merge Steps

After this PR merges, a repository admin should configure branch protection rules:

1. Navigate to **Settings** → **Branches** → **Branch protection rules**
2. Click **Add rule**
3. In "Branch name pattern", enter: `main`
4. Enable the following settings:
   - ✅ **Require status checks to pass before merging**
   - In the status checks search box, select: `type-check-and-build`
   - ✅ **Require branches to be up to date before merging**
5. Click **Create** or **Save changes**

This ensures CI must pass before any PR can be merged to main.

## Troubleshooting Common CI Failures

### TypeScript Errors

If CI fails with TypeScript errors:
1. Run `npx tsc --noEmit` locally to see the errors
2. Fix the type errors in your code
3. Commit and push the fixes

### Build Failures

If CI fails during `npm run build`:
1. Run `npm run build` locally to reproduce
2. Check for:
   - Missing dependencies (run `npm install`)
   - TypeScript errors (they will cause build to fail)
   - Syntax errors in source files
3. Fix issues and push

### Dependency Installation Failures

If `npm ci` fails:
- Ensure `package-lock.json` is committed and in sync with `package.json`
- Run `npm install` locally to regenerate package-lock.json if needed
- Commit the updated package-lock.json

## Updating Node.js Version

To update the Node.js version used in CI:

1. Edit `.github/workflows/ci.yml`
2. Change the `node-version` in the "Setup Node.js" step
3. Ensure the version is compatible with the project's requirements
4. Test locally with that Node.js version before merging

## Performance

The CI workflow includes npm caching to speed up subsequent runs. Typical execution time:
- First run (no cache): ~90-120 seconds
- Subsequent runs (cache hit): ~45-60 seconds
