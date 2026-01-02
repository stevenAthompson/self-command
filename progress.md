## [2026-01-02] Build Artifacts & Git
- Removed `dist/` from `.gitignore` to ensure pre-built artifacts are available in the repository.
- Verified `npm run build` succeeds and populates `dist/`.
- Updated `package.json` to include `prepare` script for local development convenience.

## [2026-01-02] Fix Install Script
- Removed `prepare` script from `package.json` to avoid build failures during `gemini extensions install` when devDependencies are missing.
- Verified `dist/` is up to date.
