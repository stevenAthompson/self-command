# Gemini CLI Self-Command Extension

An MCP tool that allows the Gemini CLI to send commands to itself via tmux.

## Purpose

This extension enables the Gemini agent to execute CLI commands "on itself" by injecting them into its own input stream. This is useful for self-correction, navigation, or triggering other CLI features programmatically.

## How it Works

1.  **Immediate Return:** The tool acknowledges the request and returns immediately to avoid blocking the agent.
2.  **Delay:** It waits for approximately 3 seconds to ensure the previous operation clears.
3.  **Tmux Injection:** It uses `tmux send-keys` to simulate user input in the `gemini-cli` session.

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

1.  Start a tmux session named `gemini-cli`:
    ```bash
    tmux new -s gemini-cli
    ```
2.  Inside the session, start Gemini (if not already started).
3.  Load this MCP server into Gemini.
4.  Ask Gemini to run a command on itself, e.g., "Run the 'help' command on yourself".

## Development

-   **Test:** `npm test`
-   **Build:** `npm run build`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.