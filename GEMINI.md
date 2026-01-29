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

**Example**
```javascript
// To ask for help
self_command({ command: "/help" });
```

#### How It Works
1.  **Tmux Injection**: Verifies it is running in a `tmux` session.
2.  **Delayed Execution**: Sets up a delayed background process to inject the command.
3.  **Stability Check**: Waits for the screen to be idle for **30 seconds** after execution to ensure the command has fully completed before notifying the agent to resume.

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

**Example**
```javascript
// Sleep for 60 seconds
gemini_sleep({ seconds: 60 });
```

#### How It Works
1.  **Wait**: The background process sleeps for the specified seconds.
2.  **Wake Up**: It sends a notification to the tmux session, prompting the agent to resume.

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
});
```

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
3.  **Wake Up**: Sends a notification to the tmux session when the condition is met.

---

### 4. yield_turn

Explicitly ends the turn.

#### Usage
Use this tool when you need to explicitly end your turn and ensure the CLI is ready to receive input.

**Tool Signature**
```typescript
yield_turn({});
```

**Example**
```javascript
yield_turn({});
```
