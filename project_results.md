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

### Phase 4: Final Polish & Release
- Verified build artifacts and test suite.
- Updated `gemini-extension.json` and `package.json` for correctness.
- Added explicit installation instructions for the Gemini CLI.

### Phase 5: Debugging & Stability
- Investigated reports of "Connection closed" errors.
- Verified that `dist/self_command.js` and `dist/delayed_submit.js` are correctly built and runnable.
- Confirmed that `dist/self_command.js` does not crash on startup and handles input correctly (EOF).
- Added logging (temporarily) to verify startup sequence works.
- Updated `package.json` `main` field to point to `dist/self_command.js` for correctness.
- Ensured executables in `dist/` have execute permissions.
- Verified imports from `@modelcontextprotocol/sdk` are resolving correctly.
- Re-verified build with `npm run build`.

## Test Results
- **Unit Tests:** 3/3 passed (Vitest).
- **Manual Verification:** 
    - `echo '{}' | node dist/self_command.js` exits cleanly (Exit Code 0) without error output.
    - Temporary logging confirmed the server reaches the startup phase.

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

### Why "Connection closed" error?
This usually means the server process failed to start or exited immediately. 
- Ensure `npm run build` has been run.
- Ensure `node` is available in the path.
- Try running `echo '{}' | node dist/self_command.js` manually to check for errors.
- Check if `node_modules` are properly installed.

## Troubleshooting
- **Error: Not running inside tmux session 'gemini-cli'**: Ensure you are running Gemini inside a tmux session with the exact name `gemini-cli`. Use `tmux ls` to check active sessions.
- **Command isn't typed correctly**: If the command contains complex characters, the basic escaping might need adjustment. Currently handles single quotes.
- **MCP error -32000: Connection closed**: 
    1. Run `npm run build` in the project directory.
    2. Verify `dist/self_command.js` exists.
    3. Run `echo '{}' | node dist/self_command.js`. It should output nothing and exit with code 0. If it prints an error, that is the cause.
    4. If using `nvm`, ensure the `node` version used by Gemini matches the one used to build.


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
