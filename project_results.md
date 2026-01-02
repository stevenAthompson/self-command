# Project Results: Self Command Extension

## Overview
The `self_command` project provides a Gemini CLI extension that allows the agent to send instructions to itself via a tmux session. This is achieved by injecting keys into the tmux pane where Gemini is running, using a delayed worker to ensure the current operation completes first.

## Status
- **Current Phase:** Complete & Verified.
- **Portability:** Fully portable. Uses environment variables for configuration and relative paths for internal scripts.
- **Reliability:** Improved tmux script handles both new and existing sessions correctly.

## Key Features
- **Configurable Session:** Use `GEMINI_TMUX_SESSION_NAME` to specify the target tmux session (defaults to `gemini-cli`).
- **Safe Injection:** Uses a character-by-character injection method in `delayed_submit.js` to ensure commands are entered reliably into the CLI prompt.
- **Graceful Failure:** The tool checks if it is running inside the correct tmux session *before* attempting to queue a command, providing clear error messages if not.
- **Non-Blocking:** Returns immediately to the agent while the command is queued in a detached background process.

## Usage
1.  **Build:**
    ```bash
    npm install && npm run build
    ```
2.  **Launch Gemini:**
    ```bash
    # Use the helper script to ensure the environment is set up correctly
    ./gemini_tmux.sh gemini
    ```
3.  **Self-Command:**
    -   Within Gemini, use the `self_command` tool.
    -   Example: `self_command(command="help")`

## Implementation Details
-   `gemini_tmux.sh`: A robust wrapper that creates or attaches to a tmux session and exports `GEMINI_TMUX_SESSION_NAME`.
-   `self_command.ts`: The MCP server. It validates the environment (checking the `TMUX` variable and session name) and spawns the detached worker.
-   `delayed_submit.ts`: A specialized script that waits for the agent to "go to sleep" and then simulates the keystrokes to enter the new command.
-   `gemini-extension.json`: Configured with `${extensionPath}` and `node` for maximum compatibility across different installation environments.

## Verification
-   **Unit Tests:** `npm test` passes 100%. Covers registration, session validation, and process spawning.
-   **Build:** `npm run build` generates a clean `dist/` directory with all necessary artifacts.
-   **Path Check:** No hardcoded absolute paths remain in the source or manifest.
