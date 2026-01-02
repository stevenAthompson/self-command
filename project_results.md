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
- Analyzed `run_long_command` template.
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
- Verified and cleaned up any lingering references to the base `run_long_command` project.
- Confirmed build integrity and test passage after configuration updates.

## Test Results
- **Unit Tests:** 4/4 passed (Vitest).
    - Verified proper tool registration.
    - Verified error handling when outside tmux.
    - Verified immediate response to the agent.
    - Verified correct sequence of `send-keys` commands after delay.

## FAQ
### Why is there a delay?
The delay is necessary because the Gemini CLI cannot process a new command while it is still waiting for the result of the current tool call. By returning immediately and waiting, we allow the agent to finish its current turn before the new input arrives.

### Why use tmux?
Tmux allows us to inject keystrokes into the terminal session from an external process, effectively simulating user input.

## Troubleshooting
- **Error: Not running inside tmux session 'gemini-cli'**: Ensure you are running Gemini inside a tmux session with the exact name `gemini-cli`. Use `tmux ls` to check active sessions.
- **Command isn't typed correctly**: If the command contains complex characters, the basic escaping might need adjustment. Currently handles single quotes.

## Customized Code
- `self_command.ts`: Main MCP server implementation. Contains `sendCommandDelayed` for the async logic.
- `self_command.test.ts`: Comprehensive unit tests using Vitest and mocks.
- `gemini_tmux.sh`: Helper script to launch the session.

## Usage Instructions
1.  Run `./gemini_tmux.sh` to start/attach to the session.
2.  Ensure Gemini is running.
3.  Configure Gemini to use this MCP server.
4.  Invoke the tool via natural language or direct call.