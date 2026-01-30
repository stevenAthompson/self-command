# Self Command Extension

This extension provides tools that allow the Gemini CLI agent to control its own interface via tmux, wait for tasks, monitor files, and manage the workspace.

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

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.** Do not attempt to perform other actions.

---

### 2. gemini_sleep

Sleeps for a specified duration and then sends a wake-up notification.

#### Usage
Use this tool to pause execution while waiting for a task that you know will take a specific amount of time.

**Tool Signature**
```typescript
gemini_sleep({
  seconds: number; // Number of seconds to sleep.
});
```

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.**

---

### 3. watch_log

Monitors a file and wakes the system up when it changes or matches a specific pattern.

#### Usage
Use this tool to wait for a specific event in a log file.

**Tool Signature**
```typescript
watch_log({
  file_path: string; // Absolute path to the log file to watch.
  regex?: string; // Optional regex pattern to match against new log content.
  wake_on_change?: boolean; // If true (and no regex), wakes on any file change.
  timeout_sec?: number; // Optional: Maximum time in seconds to watch. Defaults to 3600.
});
```

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.**

---

### 4. cancel_watch

Cancels active log watchers.

**Tool Signature**
```typescript
cancel_watch({
  file_path?: string; // Optional: The file path to stop watching. If omitted, cancels ALL watchers.
});
```

---

### 5. yield_turn

Explicitly ends the turn immediately.

**Tool Signature**
```typescript
yield_turn({});
```

**CRITICAL INSTRUCTION**
**You MUST NOT call any other tools in the same turn as `yield_turn`.**

---

### 6. run_long_command

Executes a long-running shell command in the background and notifies Gemini when finished.

**Tool Signature**
```typescript
run_long_command({
  command: string; // The shell command to execute.
});
```

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.**

---

### 7. send_keys

Sends keystrokes to a specific tmux pane.

#### Usage
Use this tool to interact with TUI applications, answer interactive prompts (y/n), or send control signals like `C-c`.

**Tool Signature**
```typescript
send_keys({
  keys: string; // Keys to send. E.g., "y", "Enter", "C-c".
  pane_id?: string; // Target pane ID (e.g. "%1"). Defaults to main pane if omitted.
});
```

**Example**
```javascript
send_keys({ keys: "y", pane_id: "%2" });
send_keys({ keys: "Enter", pane_id: "%2" });
```

---

### 8. capture_pane

Captures the visible text content of a tmux pane.

#### Usage
Use this tool to "see" what is happening in a pane, especially for checking the status of TUI apps or interactive commands.

**Tool Signature**
```typescript
capture_pane({
  pane_id?: string; // Target pane ID. Defaults to main pane.
  lines?: number; // Optional: Number of lines to capture from bottom.
});
```

---

### 9. create_pane

Splits the current window to create a new pane and optionally runs a command in it.

#### Usage
Use this tool to run parallel tasks (like a server) while keeping the main terminal free, or to set up a dashboard.

**Tool Signature**
```typescript
create_pane({
  command?: string; // Command to run in the new pane.
  direction?: 'vertical' | 'horizontal'; // Split direction. Defaults to vertical.
});
```

**Response**
Returns the ID of the new pane (e.g., `%2`).

---

### 10. close_pane

Closes a specific tmux pane.

#### Usage
Use this tool to clean up panes created by `create_pane`.

**Tool Signature**
```typescript
close_pane({
  pane_id: string; // The ID of the pane to close.
});
```

---

### 11. wait_for_idle

Waits for the system CPU usage to drop below a threshold for a specified duration.

#### Usage
Use this tool to wait for resource-intensive tasks (like compilation) to finish when there is no specific log message to watch.

**Tool Signature**
```typescript
wait_for_idle({
  cpu_threshold: number; // CPU usage percentage threshold (e.g. 10).
  duration_seconds: number; // Seconds to remain below threshold.
});
```

**CRITICAL INSTRUCTION**
**You MUST yield your turn immediately after calling this tool.**
