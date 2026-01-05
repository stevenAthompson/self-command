## [2026-01-04] Pivot to Background Shell Execution
- Modified `delayed_submit.ts` to execute the provided command as a shell command using `child_process.exec`, wait for its completion, and then notify Gemini via tmux.
- Updated `self_command.ts` description and input schema to reflect that it executes shell commands rather than typing commands into the CLI.
- Updated `self_command.test.ts` to match the new tool description.
- Verified changes with `npm test` and `npm run build`.