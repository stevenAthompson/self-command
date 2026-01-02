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
1.  **Install:**
    ```bash
    gemini extensions install https://github.com/stevenAthompson/self-command
    ```
2.  **Launch Gemini:**
    ```bash
    # Use the helper script to ensure the environment is set up correctly.
    # This creates (if needed) and attaches to a tmux session named 'gemini-cli' running 'gemini'.
    ./gemini_tmux.sh
    ```
3.  **Self-Command:**
    -   Within Gemini, use the `self_command` tool.
    -   Example: `self_command(command="help")`

## Implementation Details
-   `gemini_tmux.sh`: A wrapper script that creates or attaches to a tmux session named `gemini-cli`. It automatically launches the `gemini` command inside the session if creating it.
-   `self_command.ts`: The MCP server. It validates the environment (checking the `TMUX` variable and session name) and spawns the detached worker.
-   `delayed_submit.ts`: A specialized script that waits for the agent to "go to sleep" and then simulates the keystrokes to enter the new command.
-   `gemini-extension.json`: Configured with `${extensionPath}` and `node` for maximum compatibility across different installation environments.

## Verification
-   **Unit Tests:** `npm test` passes 100%. Covers registration, session validation, and process spawning.
-   **Build:** `npm run build` generates a clean `dist/` directory with all necessary artifacts.
-   **Path Check:** No hardcoded absolute paths remain in the source or manifest.

## FAQ & Troubleshooting

### Common Issues

**Q: I see an "MCP Error" or "Extension error" when starting Gemini.**
**A:** This usually means Gemini cannot locate or execute the extension script.
1.  Try uninstalling and reinstalling the extension:
    ```bash
    gemini extensions uninstall self-command
    gemini extensions install https://github.com/stevenAthompson/self-command
    ```
2.  Restart the Gemini CLI completely.

**Q: The tool returns "Error: Not running inside tmux session..."**
**A:** The extension requires running inside a specific tmux session.
1.  Exit Gemini.
2.  Use the provided script: `./gemini_tmux.sh`.
3.  This ensures the session name matches the default (`gemini-cli`) that the extension expects.

**Q: The command is typed but not executed.**
**A:** If `delayed_submit.js` types the text but doesn't hit Enter, or types it into the wrong pane:
1.  Ensure you are not interacting with the terminal while the delay (3s) is active.
2.  The script targets `${SESSION_NAME}:0.0`. If you have multiple windows or panes, it might target the wrong one. The helper script sets up a clean environment to avoid this.

**Q: Why is the `dist/` folder included in the repository?**
**A:** We include the built artifacts (`dist/`) in the git repository. This allows users to install the extension directly via `gemini extensions install <url>` without needing to run a build step manually or have development dependencies installed.
