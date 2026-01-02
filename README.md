# Gemini CLI Extension: Run Long Command

A Gemini CLI extension that enables the execution of long-running shell commands in the background without blocking the agent. It utilizes `tmux` to notify the agent upon command completion.

## Features

- **Asynchronous Execution:** Run commands like `sleep`, builds, or long scripts without timing out the Gemini CLI.
- **Auto-Notification:** "Wakes up" the Gemini agent using `tmux send-keys` when the background task finishes.
- **Fail-Safe:** Checks for the required `tmux` session environment before execution.

## Prerequisites

- **Gemini CLI**
- **tmux**: Required for session management and notifications.
- **Node.js**: Environment for running the extension.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd run-long-command
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

## Usage

### 1. Start the Tmux Session
The extension requires running inside a `tmux` session named `gemini-cli`. A helper script is provided:

```bash
./gemini_tmux.sh
```
*This will check for the session and create/attach to it as needed.*

### 2. Run Gemini CLI
Inside the tmux session, start your Gemini CLI agent.

### 3. Use the Tool
You can now ask Gemini to run long commands:

> "Run `sleep 10` in the background."

Gemini will use the `run_long_command` tool, return immediately to let you know it started, and then receive a notification (and wake up) when the command finishes.

## Development

### Running Tests
```bash
npm test
```

### Project Structure
- `run_long_command.ts`: Main MCP server implementation.
- `gemini_tmux.sh`: Setup script for the tmux environment.
- `run_long_command.test.ts`: Unit tests.

## License
MIT
