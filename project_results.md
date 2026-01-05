# Project Results: Self Command Extension

## Overview
The `self_command` project provides a Gemini CLI extension that allows the agent to execute long-running shell commands in the background without blocking the main interaction loop. The tool spawns a detached worker that executes the command, waits for it to complete, and then injects a notification message ("[SYSTEM COMMAND] Command complete. Resume.") back into the Gemini CLI via tmux.

## Status
- **Current Phase:** Pivot to Background Execution (2026-01-04).
- **Functionality:** Executes shell commands (e.g., `npm install`) in the background and notifies Gemini upon completion.
- **Portability:** Fully portable. Uses environment variables for configuration and relative paths for internal scripts.
- **Code Quality:** Professional engineering hygiene followed with docstrings, logging, and unit tests.

## Key Features
- **Background Execution:** Runs shell commands in a detached process, allowing Gemini to continue or wait without hanging.
- **Completion Notification:** Automatically sends a notification to the Gemini CLI prompt when the background command finishes.
- **Configurable Session:** Use `GEMINI_TMUX_SESSION_NAME` to specify the target tmux session (defaults to `gemini-cli`).
- **Safe Injection:** Uses a character-by-character injection method in `delayed_submit.js` to ensure the notification is entered reliably.
- **Graceful Failure:** The tool checks if it is running inside the correct tmux session *before* attempting to queue a command.
- **Standalone Installation:** The repository includes all necessary `node_modules`.

## Usage
1.  **Install:**
    ```bash
    gemini extensions install https://github.com/stevenAthompson/self-command
    ```
2.  **Launch Gemini:**
    ```bash
    # Use the helper script to ensure the environment is set up correctly.
    ./gemini_tmux.sh
    ```
3.  **Execute Command:**
    -   Within Gemini, use the `self_command` tool.
    -   Example: `self_command(command="sleep 5 && echo done")`
    -   Gemini will receive "[SYSTEM COMMAND] Command complete. Resume." after 5 seconds.

## Implementation Details
-   `gemini_tmux.sh`: A wrapper script that creates or attaches to a tmux session named `gemini-cli`.
-   `self_command.ts`: The main MCP server. Registers the `self_command` tool and spawns the detached worker.
-   `delayed_submit.ts`: A specialized worker script that:
    1. Waits 3 seconds.
    2. Executes the shell command using `child_process.exec`.
    3. Waits for the command to finish.
    4. Injects the completion notice into tmux.
-   `gemini-extension.json`: Configured with `${extensionPath}` and `node`.

## Verification Results
-   **Unit Tests:** `npm test` passes 100% (4/4 tests passed).
-   **Build:** `npm run build` succeeds.
-   **Functional:** Logic updated to support background execution and notification.

## Customized Code Description
-   `self_command.ts`: MCP server that registers the `self_command` tool.
-   `delayed_submit.ts`: Background worker that handles execution and notification.
-   `gemini_tmux.sh`: Bash script to standardize the tmux environment.

## FAQ & Troubleshooting

### FAQ
**Q: Why a 3-second delay?**
**A: To ensure the agent has finished its current response and the CLI is ready for new input.**

**Q: Can I run interactive commands?**
**A: No, the command is executed in a non-interactive shell. For interactive commands, you would need a different approach.**

### Troubleshooting Steps
1.  **Ensure you are in tmux:** Run `tmux ls`.
2.  **Check session name:** Use `./gemini_tmux.sh`.
3.  **Check build:** Run `npm run build`.

## Recent Changes (2026-01-04)
- **Feature Pivot:** Changed `self_command` to execute shell commands in the background and notify upon completion, rather than just typing text into the prompt. This supports "long-running command" workflows.
- **Implementation:** Updated `delayed_submit.ts` to use `child_process.exec` and wait for completion.