# Project Results: Self Command Extension

## Overview
The `self_command` project provides a Gemini CLI extension that allows the agent to send instructions to itself via a tmux session. This is achieved by injecting keys into the tmux pane where Gemini is running, using a delayed worker to ensure the current operation completes first.

## Status
- **Current Phase:** Complete & Verified.
- **End-to-End Verification:** Success. The `self_command` tool correctly queues and injects commands back into the Gemini CLI prompt.
- **Portability:** Fully portable. Uses environment variables for configuration and relative paths for internal scripts.
- **Code Quality:** Professional engineering hygiene followed with docstrings, logging, and unit tests.

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
    *Note: The repository includes all necessary dependencies (`node_modules`), so no post-installation `npm install` is required.*

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
-   `self_command.ts`: The main MCP server. It validates the environment (checking the `TMUX` variable and session name) and spawns the detached worker.
-   `delayed_submit.ts`: A specialized worker script that waits for 3 seconds and then simulates keystrokes to enter the new command via tmux.
-   `gemini-extension.json`: Configured with `${extensionPath}` and `node` for maximum compatibility across different installation environments.

## Verification Results
-   **Unit Tests:** `npm test` passes 100% (4/4 tests passed).
-   **Build:** `npm run build` succeeds and generates the `dist/` directory.
-   **Linting/Standards:** Code follows project conventions and includes necessary documentation.

## Customized Code Description
-   `self_command.ts`: MCP server that registers the `self_command` tool. It performs pre-flight checks to ensure it's running in tmux.
-   `delayed_submit.ts`: Background worker that handles the 3-second delay and tmux key injection.
-   `gemini_tmux.sh`: Bash script to standardize the tmux environment for the extension.

## FAQ & Troubleshooting

### FAQ
**Q: Why a 3-second delay?**
**A: To ensure the agent has finished its current response and the CLI is ready for new input.**

**Q: Can I change the tmux session name?**
**A: Yes, set the `GEMINI_TMUX_SESSION_NAME` environment variable.**

### Troubleshooting Steps
1.  **Ensure you are in tmux:** Run `tmux ls` to see if `gemini-cli` exists.
2.  **Check session name:** Use `./gemini_tmux.sh` to ensure you are in the expected session.
3.  **Check build:** Run `npm run build` to ensure JavaScript files are up to date.
4.  **Check logs:** If possible, check the terminal where Gemini is running for any injection artifacts.

## Recent Changes (2026-01-02)
- **Licensing:** Updated all source files and metadata to reflect the author as **Steven A. Thompson**.
- **Distribution:** Configured the project to include `node_modules` and `package-lock.json` in the repository. This ensures that end-users do not need to run `npm install` manually after installing the extension.
- **Documentation:** Updated installation instructions to reflect the self-contained nature of the repository.

## Challenges Overcome
- **Backgrounding in Node.js:** Used `spawn` with `detached: true` and `unref()` to ensure the worker process lives independently of the MCP server's response cycle.
- **Tmux Key Injection:** Implemented a slow-typing technique to avoid overwhelming the CLI input buffer.
- **Portability:** Ensured all paths are resolved dynamically using `import.meta.url` and `path.join`.