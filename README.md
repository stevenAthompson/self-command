# Gemini CLI Self-Command Extension

An MCP tool that allows the Gemini CLI to send commands to itself via tmux.

## Purpose

This extension enables the Gemini agent to execute CLI commands "on itself" by injecting them into its own input stream. This is useful for self-correction, navigation, or triggering other CLI features programmatically.

## How it Works

1.  **Immediate Return:** The tool acknowledges the request and returns immediately to avoid blocking the agent.
2.  **Stability Check:** It waits for the terminal screen to become stable (no output changes) to ensure no other processes are writing to the screen before it begins typing.
3.  **Tmux Injection:** It uses `tmux send-keys` to simulate user input in the `gemini-cli` session.
4.  **Monitoring & Resume:** A background worker monitors the terminal output. Once it detects the command has finished (by observing screen stability), it sends a "Resume" signal to the agent, ensuring the agent knows when it can proceed.

## Tools

### self_command
Sends a command to the Gemini CLI. It waits for the session to stabilize after the command is sent and then notifies the agent to resume.

### yield_turn
Explicitly ends the agent's current turn and prepares the CLI for subsequent input.

**Why it exists:**
The Gemini agent is not naturally "aware" of background processes or tmux-style key injections. When a command is scheduled (e.g., via the run-long-command extension or similar mechanisms), the agent may need to stop generating and wait for that specific task to complete. `yield_turn` sends a `Ctrl-C` followed by two `Enter` keys to the tmux session, clearing the input line and ensuring the CLI prompt is fresh and ready for the next event. This helps it to avoid loops and polling that might cause it to become "stuck."

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