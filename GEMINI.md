# Self Command Extension

This extension provides the `self_command` tool, which allows the Gemini CLI agent to control its own interface by injecting commands into the active tmux session.

## Usage

Use this tool when you need to execute a Gemini CLI command programmatically, such as running a specific /command, listing files, or triggering other agent actions.

### Tool Signature

```typescript
self_command({
  command: string; // The command to send to Gemini (e.g., "help", "list files").
});
```

### Example

```javascript
// To ask for help
self_command({ command: "help" });
```

## How It Works

1.  **Tmux Injection**: The tool verifies it is running in a `tmux` session.
2.  **Delayed Execution**: It sets up a delayed background process to inject the command.
3.  **Immediate Return**: The tool returns immediately to you.

## CRITICAL INSTRUCTION

**You MUST yield your turn immediately after calling this tool.** 

Do not attempt to perform other actions or wait for the result in the same turn. The injected command will be processed by the CLI as a new user input *after* your current turn ends. If you continue generating, you might interfere with the injected command.

## Expected Output

You will receive an immediate confirmation that the command has been scheduled.

```text
Command 'help' scheduled for execution. I will yield my turn now to allow it to run.
```