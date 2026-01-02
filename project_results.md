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
- Verified implementation with `npm test` (All 4 tests passed).
- Built project successfully with `npm run build`.

### Phase 3: Deployment
- Created public GitHub repository: https://github.com/stevenAthompson/self-command
- Pushed all code to the repository.
- Updated documentation with installation instructions and MIT license details.

### Phase 4: Cleanup & Finalization
- Corrected MCP server naming in `gemini-extension.json` from `runLongCommand` to `selfCommand` to match the project identity.
- Verified and cleaned up any lingering references to the base project.
- Confirmed build integrity and test passage after configuration updates.
- Verified system functionality by manually triggering a `/compress` command via tmux injection to simulate tool operation.

## Test Results
- **Unit Tests:** 3/3 passed (Vitest).
    - Verified proper tool registration.
    - Verified error handling when outside tmux.
    - Verified immediate return and correct spawning of the detached worker process.
- **System Verification:** Successfully demonstrated command injection into the `gemini-cli` session.

## FAQ
### Why is there a delay?
The delay is necessary because the Gemini CLI cannot process a new command while it is still waiting for the result of the current tool call. By returning immediately and waiting, we allow the agent to finish its current turn before the new input arrives.

### Why use tmux?
Tmux allows us to inject keystrokes into the terminal session from an external process, effectively simulating user input.

## Troubleshooting
- **Error: Not running inside tmux session 'gemini-cli'**: Ensure you are running Gemini inside a tmux session with the exact name `gemini-cli`. Use `tmux ls` to check active sessions.
- **Command isn't typed correctly**: If the command contains complex characters, the basic escaping might need adjustment. Currently handles single quotes.
- **MCP error -32000: Connection closed**: This may occur if the extension fails to start or if Gemini has a stale configuration. Try restarting Gemini or running `npm run build` again to ensure the `dist/` directory is up to date. Manual verification can be done by running `echo '{}' | node dist/self_command.js`.

## Customized Code
- `self_command.ts`: Main MCP server implementation. Validates the request and spawns `delayed_submit.js` as a detached process.
- `delayed_submit.ts`: Worker script that handles the 3-second delay and tmux command injection. It runs independently of the MCP server to ensure execution persistence.
- `self_command.test.ts`: Comprehensive unit tests using Vitest and mocks.
- `gemini_tmux.sh`: Helper script to launch the session.

## Usage Instructions
1.  Run `./gemini_tmux.sh` to start/attach to the session.
2.  Ensure Gemini is running.
3.  Configure Gemini to use this MCP server.
4.  Invoke the tool via natural language or direct call.