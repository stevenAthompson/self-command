# Gemini CLI Self-Command Extension

An MCP tool that allows the Gemini CLI to send commands to itself, run very long commands in the background and be woken, sleep for a specified amount of time, watch logs and receive notifications, etc by leveraging tmux. After installing the extension you must lauch gemini-cli via tmux using the provided shell script or with something like: **SESSION_NAME="gemini-cli"; tmux new-session -d -s $SESSION_NAME 'gemini'; tmux attach -t $SESSION_NAME**

## Purpose

This extension enables the Gemini agent to execute CLI commands "on itself" by injecting them into its own input stream. This is useful for self-correction, navigation, or triggering other CLI features programmatically.

## How it Works

1.  **Immediate Return:** The tool acknowledges the request and returns immediately to avoid blocking the agent. Each request returns a unique **Request ID** (e.g., `[A1B2]`) which is also included in the final completion notification, allowing the agent to correlate actions with results.
2.  **Stability Check:** All tools wait for the terminal screen to become stable (no output changes for **10 seconds**) before injecting any keystrokes. This ensures they do not interrupt the agent or the user.
3.  **Tmux Injection:** It uses `tmux send-keys` to simulate user input in the `gemini-cli` session.
4.  **Serialized Notifications:** All background notifications are serialized using a file-based lock. This prevents garbled output when multiple tasks (like a long command and a log watcher) complete simultaneously.
5.  **Monitoring & Resume:** A background worker monitors the terminal output. Once it detects the command has finished (by observing screen stability), it sends a "Resume" signal to the agent, ensuring the agent knows when it can proceed.

## Tools

### self_command
Sends a command to the Gemini CLI. It waits for the session to stabilize after the command is sent and then notifies the agent to resume. Returns a unique Request ID.

### gemini_sleep
Sleeps for a specified number of seconds and then sends a wake-up notification to the tmux session. Returns a unique Request ID.

### watch_log
Monitors a log file and wakes the system up when the file changes or when new content matches a provided regex pattern. Supports a configurable timeout. Returns a unique Request ID.

### cancel_watch
Cancels active log watchers, either globally or for a specific file. Now gracefully handles cases where no matching watchers are found.

### yield_turn
Acts as an immediate interrupt that terminates the agent's current turn by sending `Ctrl-C` and preparing the CLI for subsequent input. Returns a unique Request ID.

**Why it exists:**
The Gemini agent is not naturally "aware" of background processes or tmux-style key injections. When a command is scheduled (e.g., via the run-long-command extension), the agent needs to stop its current turn to wait for the completion notification. `yield_turn` breaks the execution loop by sending an interrupt signal after a minimal delay (500ms).

**CRITICAL:** This tool MUST be the only action in your turn. Combining it with other tools will cause session state corruption and cancelled commands.

### run_long_command
Executes a long-running shell command in the background without blocking the agent. It notifies Gemini upon completion (success or failure) by injecting a message into the tmux session. Returns a unique Request ID.

## Prerequisites

-   **Tmux:** You must run the Gemini CLI inside a tmux session named `gemini-cli`.
-   **Node.js:** Required to run the MCP server.

## Installation

### Standard Installation (Recommended)
You can install this extension directly via the Gemini CLI:
```bash
gemini extensions install https://github.com/stevenAthompson/self-command
```

### Manual Installation
1.  Clone this repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```

## Usage

1.  Start the tmux session using the helper script:
    ```bash
    ./gemini_tmux.sh
    ```
2.  Inside the session, start Gemini (if not already started).
3.  Load this MCP server into Gemini.
4.  Ask Gemini to run a command on itself, e.g., "Run the 'help' command on yourself".

## Development

-   **Test:** `npm test`
-   **Build:** `npm run build`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
