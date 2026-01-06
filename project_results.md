# Project Results: Self Command Extension

## Overview
The `self_command` project provides a Gemini CLI extension that allows the agent to send instructions to itself via a tmux session. This is achieved by injecting keys into the tmux pane where Gemini is running. Crucially, the tool spawns a background worker that waits for the command to finish executing (by monitoring the terminal for inactivity) before notifying Gemini to resume.

## Status
- **Current Phase:** Monitoring Implementation (2026-01-04).
- **Functionality:** Injects Gemini commands, monitors the terminal for output stability (idle state), and then sends a completion signal.
- **Portability:** Fully portable. Uses environment variables for configuration and relative paths.
- **Code Quality:** Professional engineering hygiene followed with docstrings, logging, and unit tests.

## Key Features
- **Configurable Session:** Use `GEMINI_TMUX_SESSION_NAME` to specify the target tmux session (defaults to `gemini-cli`).
- **Safe Injection:** Uses a character-by-character injection method in `delayed_submit.js` to ensure commands are entered reliably.
- **Completion Monitoring:** The worker script polls the tmux pane content. If the content remains stable (unchanged) for 3 consecutive seconds, it assumes the command has finished.
- **Resume Notification:** Sends `[SYSTEM COMMAND] Command complete. Resume.` to the agent once the command is done.
- **Graceful Failure:** The tool checks if it is running inside the correct tmux session *before* attempting to queue a command.
- **Non-Blocking:** Returns immediately to the agent while the command and monitoring run in a detached background process.

## Usage
1.  **Install:**
    ```bash
    gemini extensions install https://github.com/stevenAthompson/self-command
    ```
2.  **Launch Gemini:**
    ```bash
    ./gemini_tmux.sh
    ```
3.  **Self-Command:**
    -   Within Gemini, use the `self_command` tool.
    -   Example: `self_command(command="fetch_posts")`
    -   The agent will receive a confirmation immediately.
    -   The command executes.
    -   When output stops streaming/printing, the agent receives: `[SYSTEM COMMAND] Command complete. Resume.`

## Implementation Details
-   `gemini_tmux.sh`: A wrapper script that creates or attaches to a tmux session named `gemini-cli`.
-   `self_command.ts`: The main MCP server. Registers the `self_command` tool and spawns the detached worker.
-   `delayed_submit.ts`: A specialized worker script that:
    1. Waits 3 seconds.
    2. Injects the command via `tmux send-keys`.
    3. Enters a loop: `tmux capture-pane` every 1s.
    4. If pane is stable for 3 checks, injects the resume notification.
-   `gemini-extension.json`: Configured with `${extensionPath}` and `node`.
-   `GEMINI.md`: Provides usage instructions and context for the agent using the extension.

## Verification Results
-   **Unit Tests:** `npm test` passes 100% (4/4 tests passed).
-   **Build:** `npm run build` succeeds.
-   **Stability Logic:** Uses a sliding window of stability checks (default 3 checks * 1 sec interval) with a max timeout of 5 minutes.
-   **Post-Fix Verification:** SUCCESS. The tool remains fully operational after restoring `node_modules` and `dist` to git tracking. End-to-end functionality confirmed with 'list files' test command.
-   **Stability Polling Test (10s Sleep):** SUCCESS. Verified that the background worker correctly monitors the tmux pane and only sends the resume signal after the 'sleep 10' command has completed and the output has stabilized.
-   **Manual Verification:** Verified that running `delayed_submit.js` manually correctly targets the active tmux pane and injects keys (confirmed by "User cancelled the operation" message when running in foreground, indicating successful interruption of the running process). This confirms the key injection mechanism works as intended.

## Customized Code Description
-   `self_command.ts`: MCP server that registers the `self_command` tool.
-   `delayed_submit.ts`: Background worker that handles execution and monitoring.
-   `gemini_tmux.sh`: Bash script to standardize the tmux environment.

## FAQ & Troubleshooting

### FAQ
**Q: How does it know when a command is done?**
**A: It looks for visual stability. If the terminal screen doesn't change for 3 seconds, it assumes the command has finished outputting.**

**Q: What if the command has long pauses?**
**A: The stability check might trigger prematurely. This is a heuristic approach suitable for typical REPL interactions.**

### Troubleshooting Steps
1.  **Ensure you are in tmux:** Run `tmux ls` to see if `gemini-cli` exists.
2.  **Check session name:** Use `./gemini_tmux.sh` to ensure you are in the expected session.
3.  **Check build:** Run `npm run build`.
4.  **Linking for development:** Use `gemini extensions link .` (do not use `install link`).

## Recent Changes (2026-01-05)
- **Version Bump:** Bumped version to 1.0.1 for release.
- **Monitoring Feature:** Updated `delayed_submit.ts` to include a polling loop that watches `tmux capture-pane`. This ensures the resume notification is sent only after the command's output has stabilized.
- **Revert:** Reverted the previous attempt to run commands as shell sub-processes. We are strictly operating on the tmux session.
- **Command Guidance:** Clarified the correct command for linking local extensions to resolve user confusion between `install` and `link`.