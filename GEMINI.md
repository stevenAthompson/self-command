# Self Command Extension

This extension provides tools that allow the Gemini CLI agent to control its own interface via tmux, wait for tasks, and monitor files.

## Tools

### 1. self_command

Executes a Gemini CLI command programmatically.

#### Usage
Use this tool when you need to execute a Gemini CLI command, such as running a specific /command, listing files, or triggering other agent actions.

**Tool Signature**
```typescript
self_command({
  command: string; // The command to send to Gemini (e.g., "/compress", "/help").
});
```

**Response**
Returns a text message confirming the task has started, including a unique **Request ID** (e.g., `[A1B2]`). This ID will also appear in the completion notification.

**Example**
```javascript
// To ask for help
self_command({ command: "/help" });
```

#### How It Works
1.  **Tmux Injection**: Verifies it is running in a `tmux` session.
2.  **Delayed Execution**: Sets up a delayed background process to inject the command.
3.  **Pre-Execution Stability**: Waits for the screen to be idle for **10 seconds** before typing the command to ensure safety.
4.  **Post-Execution Stability**: Waits for the screen to be idle for **10 seconds** after execution to ensure the command has fully completed before notifying the agent to resume.

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.** Do not attempt to perform other actions.

---

### 2. gemini_sleep

Sleeps for a specified duration and then sends a wake-up notification.

#### Usage
Use this tool to pause execution while waiting for a task that you know will take a specific amount of time, or when you simply need to wait before proceeding.

**Tool Signature**
```typescript
gemini_sleep({
  seconds: number; // Number of seconds to sleep.
});
```

**Response**
Returns a confirmation with a **Request ID**. The subsequent wake-up notification will include this same ID.

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.** Do not attempt to perform other actions in the same turn. This tool must be the LAST and ONLY tool called if you intend to wait for the sleep to complete.

---

### 3. watch_log

Monitors a file and wakes the system up when it changes or matches a specific pattern.

#### Usage
Use this tool to wait for a specific event in a log file (like a "Build Complete" message) or simply to wait for any activity in a file.

**Tool Signature**
```typescript
watch_log({
  file_path: string; // Absolute path to the log file to watch.
  regex?: string; // Optional regex pattern to match against new log content.
  wake_on_change?: boolean; // If true (and no regex), wakes on any file change. Defaults to true.
  timeout_sec?: number; // Optional: Maximum time in seconds to watch. Defaults to 3600 (1 hour).
});
```

**Response**
Returns a confirmation with a **Request ID**. The notification triggered by a match or file change will include this ID.

**Examples**
```javascript
// Wake up when "Build Successful" appears in the log
watch_log({
  file_path: "/path/to/build.log",
  regex: "Build Successful" 
});

// Wake up on any change to the log
watch_log({
  file_path: "/path/to/server.log"
});
```

#### How It Works
1.  **Monitor**: Polls the file for changes.
2.  **Match**: If `regex` is provided, it scans *new* content for a match. If `regex` is omitted, it triggers on any size change.
3.  **Stability Check**: Waits for the screen to be idle for **10 seconds** before injecting the notification.
4.  **Wake Up**: Sends a notification to the tmux session when the condition is met.

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.** Do not attempt to perform other actions in the same turn. This tool must be the LAST and ONLY tool called if you intend to wait for the watch to trigger.

---

### 4. cancel_watch

Cancels active log watchers.

#### Usage
Use this tool to stop monitoring specific files or to cancel all active watchers.

**Tool Signature**
```typescript
cancel_watch({
  file_path?: string; // Optional: The file path to stop watching. If omitted, cancels ALL watchers.
});
```

**Example**
```javascript
// Cancel all watchers for a specific file
cancel_watch({ file_path: "/path/to/build.log" });

// Cancel ALL active watchers
cancel_watch({});
```

---

### 5. yield_turn

Explicitly ends the turn immediately.

#### Usage
Use this tool ONLY when you need to immediately terminate your current turn and return control to the user or await a background notification. This tool acts as an interrupt.

**Tool Signature**
```typescript
yield_turn({});
```

**Response**
Returns a confirmation with a **Request ID**.

**Example**
```javascript
yield_turn({});
```

#### How It Works
1.  **Immediate Interrupt**: Sends `Ctrl-C` followed by two `Enter` keystrokes to the tmux session after a minimal delay (500ms). This breaks the current command loop.

**CRITICAL INSTRUCTION**
**You MUST NOT call any other tools in the same turn as `yield_turn`.** Calling other tools alongside `yield_turn` will lead to race conditions, cancelled commands, and session state corruption. This tool must be the SOLE action in your response.

---

### 6. run_long_command

Executes a long-running shell command in the background and notifies Gemini when finished.

#### Usage
Use this tool when you encounter a task that involves a command expected to take a significant amount of time (e.g., complex builds, long-running tests, data processing) and you want to continue working or simply wait without blocking the CLI.

**Tool Signature**
```typescript
run_long_command({
  command: string; // The shell command to execute.
});
```

**Response**
Returns an immediate confirmation message containing the Background PID and a **Request ID** (e.g., `[A1B2]`). When the command completes, a notification with the same ID will be injected into the tmux session.

**Example**
```javascript
run_long_command({ command: "npm run build-heavy-project" });
```

#### How It Works
1.  **Background Execution**: Spawns the command as a detached background process.
2.  **Immediate Return**: Returns immediately to the agent, confirming the task has started.
3.  **Completion Notification**: When the command finishes, it uses `tmux` to inject a completion message (including exit code and a summary of output) into the agent's session, effectively "waking" it up.

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.** Do not attempt to perform other actions in the same turn.