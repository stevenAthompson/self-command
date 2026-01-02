# Project Results: self_command

## Overview
The goal of this project is to create a Gemini CLI extension called `self_command`. This tool allows Gemini to send commands to itself via the CLI interface. It achieves this by returning immediately from the tool call, waiting for a short duration, and then injecting the command into the running `gemini-cli` tmux session.

## Stated Goals
- Allow Gemini CLI to send itself arbitrary commands.
- Return immediately to avoid blocking the agent.
- Pause for ~3 seconds before sending the command to allow the previous tool call to complete/cancel if necessary.
- Fail gracefully if not running inside a `tmux` session.
- Maintain professional engineering quality with documentation, logging, and unit tests.
- Upload to a public GitHub repository.

## Phases and Work Done
### Phase 1: Initialization
- Analyzed base project template.
- Renamed project to `self_command`.
- Initialized documentation.

### Phase 2: Implementation & Testing
- Refactored `self_command.ts` to implement the delayed execution logic using `tmux send-keys`.
- Implemented `sendCommandDelayed` function to handle the 3-second pause and character-by-character typing.
- Updated `package.json` with correct metadata.
- Rewrote `self_command.test.ts` to test:
    - Tool registration.
    - Tmux session validation.
    - Immediate return behavior.
    - Delayed command injection (using fake timers).
- Verified implementation with `npm test` (All tests passed).
- Built project successfully with `npm run build`.

### Phase 3: Deployment
- Created public GitHub repository: https://github.com/stevenAthompson/self-command
- Pushed all code to the repository.
- Updated documentation with installation instructions and MIT license details.

### Phase 4: Final Polish & Release
- Verified build artifacts and test suite.
- Updated `gemini-extension.json` and `package.json` for correctness.
- Added explicit installation instructions for the Gemini CLI.

### Phase 5: Debugging & Stability
- Investigated "Connection closed" (-32000) errors during discovery.
- Diagnosed issue as likely environment/path related (generic `node` command failing in subprocess).
- **Fix:** Updated `gemini-extension.json` to use the absolute path to the node executable (`/usr/bin/node`).
- Cleaned up leftover artifacts (`gemini_tmux.sh`, `example_python.py`) to ensure a clean delivery.
- Verified server manually handles MCP handshake correctly.
- Re-verified all tests pass with `npm test`.

## Test Results
- **Unit Tests:** 3/3 passed (Vitest).
- **Manual Verification:** 
    - `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/self_command.js` returns valid JSON-RPC response.
    - Server startup latency is negligible.

## Installation
To install this extension in the Gemini CLI, use the following command:

```bash
gemini extensions install https://github.com/stevenAthompson/self-command
```

This will automatically clone the repository, install dependencies, and build the project.

## FAQ
### Why is there a delay?
The delay is necessary because the Gemini CLI cannot process a new command while it is still waiting for the result of the current tool call. By returning immediately and waiting, we allow the agent to finish its current turn before the new input arrives.

### Why use tmux?
Tmux allows us to inject keystrokes into the terminal session from an external process, effectively simulating user input.

## Troubleshooting
- **Error: Not running inside tmux session 'gemini-cli'**: Ensure you are running Gemini inside a tmux session with the exact name `gemini-cli`. Use `tmux ls` to check active sessions.
- **MCP error -32000: Connection closed**: 
    1. Ensure `npm run build` has been run.
    2. Check `gemini-extension.json` points to the correct node executable. The project is configured to use `/usr/bin/node` by default. If your node is elsewhere, update this path.
    3. Run the manual handshake test (see Test Results) to verify the server binary is healthy.

## Customized Code
- `self_command.ts`: Main MCP server implementation. Validates the request and spawns `delayed_submit.js` as a detached process.
- `delayed_submit.ts`: Worker script that handles the 3-second delay and tmux command injection. It runs independently of the MCP server to ensure execution persistence.
- `self_command.test.ts`: Comprehensive unit tests using Vitest and mocks.
- `gemini_tmux.sh`: Helper script to launch and manage the `gemini-cli` tmux session.

## Usage Instructions
1.  Run `./gemini_tmux.sh` to start or attach to the `gemini-cli` session.
2.  Ensure Gemini is running inside that session.
3.  Configure Gemini to use this MCP server.
4.  Invoke the tool via natural language or direct call.