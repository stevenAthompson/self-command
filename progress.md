## [2026-01-04] Added Command Completion Monitoring
- Reverted the pivot to shell execution (back to tmux command injection).
- Modified `delayed_submit.ts` to monitor the tmux pane for stability (no changes for ~3 seconds) after sending a command.
- Once stability is detected (implying command completion), a notification `[SYSTEM COMMAND] Command complete. Resume.` is sent to the Gemini CLI.
- Updated `self_command.ts` description to reflect this monitoring capability.
- Verified functionality via manual foreground execution which successfully targeted the running session.
- Committed changes.