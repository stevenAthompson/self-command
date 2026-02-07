/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
// Import shared utilities
import { isInsideTmuxSession, sendNotification, SESSION_NAME, sendKeys, capturePane, splitWindow, killPane } from './tmux_utils.js';
const server = new McpServer({
    name: 'self-command-server',
    version: '1.0.0',
});
// Resolve the path to the worker scripts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUBMIT_WORKER_SCRIPT = path.join(__dirname, 'delayed_submit.js');
const YIELD_WORKER_SCRIPT = path.join(__dirname, 'instant_yield.js');
const SLEEP_WORKER_SCRIPT = path.join(__dirname, 'delayed_sleep.js');
const WATCH_WORKER_SCRIPT = path.join(__dirname, 'delayed_watch.js');
const IDLE_WORKER_SCRIPT = path.join(__dirname, 'delayed_idle.js');
const PID_DIR = path.join(__dirname, 'pids');
/**
 * Generates a unique ID for request tracking.
 * Uses a short timestamp based string.
 */
function getNextId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}
server.registerTool('wait_for_idle', {
    description: 'Waits for the system CPU usage to drop below a threshold for a specified duration.',
    inputSchema: z.object({
        cpu_threshold: z.number().positive().max(100).describe('CPU usage percentage threshold (e.g. 10 for 10%).'),
        duration_seconds: z.number().positive().describe('Number of seconds the CPU must remain below the threshold.'),
    }),
}, async ({ cpu_threshold, duration_seconds }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    const id = getNextId();
    try {
        const subprocess = spawn(process.execPath, [IDLE_WORKER_SCRIPT, cpu_threshold.toString(), duration_seconds.toString(), id], {
            detached: true,
            stdio: 'ignore',
            cwd: __dirname
        });
        subprocess.unref();
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to schedule idle watch [${id}]: ${err}` }],
            isError: true,
        };
    }
    return {
        content: [{ type: 'text', text: `Idle monitor [${id}] started. Waiting for CPU < ${cpu_threshold}% for ${duration_seconds}s.` }],
    };
});
server.registerTool('self_command', {
    description: 'Sends a command to the Gemini CLI via tmux. Returns immediately, waits for the command to execute and the session to stabilize, and then sends a completion notification.',
    inputSchema: z.object({
        command: z.string().describe('The command to send to Gemini (e.g., "help", "list files").'),
    }),
}, async ({ command }) => {
    // Check if we are in the correct tmux session BEFORE starting
    if (!isInsideTmuxSession()) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: Not running inside tmux session '${SESSION_NAME}'. This tool requires being in a tmux session named '${SESSION_NAME}' to send commands to itself.`,
                },
            ],
            isError: true,
        };
    }
    const id = getNextId();
    // Spawn the worker script detached
    // We encode the command to base64 to avoid argument parsing issues
    const encodedCommand = Buffer.from(command).toString('base64');
    try {
        const subprocess = spawn(process.execPath, [SUBMIT_WORKER_SCRIPT, encodedCommand, id], {
            detached: true,
            stdio: 'ignore', // Ignore stdio to allow parent to exit
            cwd: __dirname
        });
        subprocess.unref(); // Allow the parent process to exit independently
    }
    catch (err) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Failed to schedule command execution [${id}]: ${err}`,
                },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Background task [${id}] queued. Will execute "${command}" in ~3 seconds. Wait for completion signal.`,
            },
        ],
    };
});
server.registerTool('send_keys', {
    description: 'Sends keystrokes to a specific tmux pane. Useful for interacting with TUI apps, confirming prompts, or sending control signals (like C-c).',
    inputSchema: z.object({
        keys: z.string().describe('The keys to send. Use "C-c" for Ctrl+C, "Enter" for return, "Up" for arrow keys.'),
        pane_id: z.string().optional().describe('The target pane ID (e.g. "%1"). If omitted, defaults to the current active pane (careful!).'),
    }),
}, async ({ keys, pane_id }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    // Default to current pane if not specified, but be careful.
    // However, if we are running as the agent, "current pane" is the agent's pane.
    // Sending keys to self is okay if that's the intent, but usually we want a target.
    const target = pane_id || `${SESSION_NAME}:0.0`; // Default to the main pane if unsure, or maybe allow omitted?
    // Actually, tmux defaults to current if -t is omitted, but we enforce it in utils.
    try {
        sendKeys(target, keys);
        return {
            content: [{ type: 'text', text: `Sent keys "${keys}" to pane ${target}.` }],
        };
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to send keys: ${err}` }],
            isError: true,
        };
    }
});
server.registerTool('capture_pane', {
    description: 'Captures the visible text content of a tmux pane. Useful for checking the status of TUI apps or reading output.',
    inputSchema: z.object({
        pane_id: z.string().optional().describe('The target pane ID. If omitted, captures the current pane.'),
        lines: z.number().int().positive().optional().describe('Number of lines to capture from the bottom history. If omitted, captures the visible screen.'),
    }),
}, async ({ pane_id, lines }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    const target = pane_id || `${SESSION_NAME}:0.0`;
    try {
        const content = capturePane(target, lines);
        return {
            content: [{ type: 'text', text: content }],
        };
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to capture pane: ${err}` }],
            isError: true,
        };
    }
});
server.registerTool('create_pane', {
    description: 'Splits the current window to create a new pane and optionally runs a command in it.',
    inputSchema: z.object({
        command: z.string().optional().describe('The command to run in the new pane.'),
        direction: z.enum(['vertical', 'horizontal']).optional().describe('Split direction. "vertical" (top/bottom) or "horizontal" (left/right). Defaults to vertical.'),
    }),
}, async ({ command, direction }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    try {
        const paneId = splitWindow(command, direction);
        return {
            content: [{ type: 'text', text: `Created new pane ${paneId}${command ? ` running "${command}"` : ''}.` }],
        };
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to create pane: ${err}` }],
            isError: true,
        };
    }
});
server.registerTool('close_pane', {
    description: 'Closes a specific tmux pane.',
    inputSchema: z.object({
        pane_id: z.string().describe('The ID of the pane to close (e.g. "%1").'),
    }),
}, async ({ pane_id }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    try {
        killPane(pane_id);
        return {
            content: [{ type: 'text', text: `Closed pane ${pane_id}.` }],
        };
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to close pane: ${err}` }],
            isError: true,
        };
    }
});
server.registerTool('run_long_command', {
    description: 'Executes a long-running shell command in the background and notifies Gemini when finished.',
    inputSchema: z.object({
        command: z.string().describe('The shell command to execute.'),
    }),
}, async ({ command }) => {
    // Check if we are in the correct tmux session BEFORE starting the command
    if (!isInsideTmuxSession()) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: Not running inside tmux session '${SESSION_NAME}'. This tool requires being in a tmux session named '${SESSION_NAME}' to wake up the agent upon completion.`,
                },
            ],
            isError: true,
        };
    }
    const id = getNextId();
    const startTime = Date.now();
    // Spawn the background process
    const child = spawn(command, {
        shell: true,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const MAX_OUTPUT_LENGTH = 200;
    if (child.stdout) {
        child.stdout.on('data', (data) => {
            if (output.length < MAX_OUTPUT_LENGTH) {
                output += data.toString();
            }
        });
    }
    if (child.stderr) {
        child.stderr.on('data', (data) => {
            if (output.length < MAX_OUTPUT_LENGTH) {
                output += data.toString();
            }
        });
    }
    // Set up completion handler
    child.on('close', async (code) => {
        try {
            const duration = Date.now() - startTime;
            const MAX_MSG_LEN = 64;
            const codeStr = `(${code})`;
            // Truncate command
            let cmdStr = command;
            const maxCmdLen = 15;
            if (cmdStr.length > maxCmdLen) {
                cmdStr = cmdStr.substring(0, maxCmdLen - 3) + '...';
            }
            // Calculate available space for output
            const overhead = 22 + cmdStr.length + codeStr.length; // Extra 5 for ID
            const availableForOut = MAX_MSG_LEN - overhead;
            let outStr = output ? output.replace(/[\r\n]+/g, ' ').trim() : '';
            if (outStr.length > availableForOut) {
                const truncateLen = Math.max(0, availableForOut - 3);
                outStr = outStr.substring(0, truncateLen) + '...';
            }
            let completionMessage = `[${id}] Cmd: "${cmdStr}" ${codeStr} Out: [${outStr}]`;
            if (duration < 1000) {
                completionMessage += " (Warn: Instant Exit)";
            }
            const target = `${SESSION_NAME}:0.0`;
            await sendNotification(target, completionMessage);
        }
        catch (err) {
            // Prevent server crash on notification failure
            console.error(`Failed to send completion notification for [${id}]:`, err);
        }
    });
    child.on('error', async (err) => {
        try {
            const MAX_MSG_LEN = 64;
            let cmdStr = command;
            const maxCmdLen = 15;
            if (cmdStr.length > maxCmdLen) {
                cmdStr = cmdStr.substring(0, maxCmdLen - 3) + '...';
            }
            const overhead = 15 + cmdStr.length; // Extra 5 for ID
            const availableForErr = MAX_MSG_LEN - overhead;
            let errStr = err.message;
            if (errStr.length > availableForErr) {
                const truncateLen = Math.max(0, availableForErr - 3);
                errStr = errStr.substring(0, truncateLen) + '...';
            }
            const errorMessage = `[${id}] Err: "${cmdStr}" (${errStr})`;
            const target = `${SESSION_NAME}:0.0`;
            await sendNotification(target, errorMessage);
        }
        catch (notifyErr) {
            // Prevent server crash on notification failure
            console.error(`Failed to send error notification for [${id}]:`, notifyErr);
        }
    });
    return {
        content: [
            {
                type: 'text',
                text: `Command [${id}] "${command}" started in the background (PID: ${child.pid}, CWD: ${process.cwd()}). I will notify you when it finishes.`,
            },
        ],
    };
});
server.registerTool('gemini_sleep', {
    description: 'Sleeps for a specified number of seconds and then sends a tmux message to wake the system up. Useful for waiting for long-running background tasks. Enforces a single active sleep policy (shorter duration wins).',
    inputSchema: z.object({
        seconds: z.number().positive().describe('Number of seconds to sleep (or interval if recurring).'),
        recurring: z.boolean().optional().describe('If true, wakes up every X seconds. Minimum 3600s (1 hour) for recurring sleep. Defaults to false.'),
    }),
}, async ({ seconds, recurring }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    if (recurring && seconds < 3600) {
        return {
            content: [{ type: 'text', text: `Error: Recurring sleep requires a minimum interval of 3600 seconds (1 hour). Requested: ${seconds}s.` }],
            isError: true,
        };
    }
    // Ensure PID_DIR exists
    if (!fs.existsSync(PID_DIR)) {
        fs.mkdirSync(PID_DIR, { recursive: true });
    }
    const stateFile = path.join(PID_DIR, 'active_sleep.json');
    let activeSleep = null;
    // Check for existing active sleep
    if (fs.existsSync(stateFile)) {
        try {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            // Check if process is actually alive
            try {
                process.kill(state.pid, 0);
                activeSleep = state;
            }
            catch (e) {
                // Process dead, clean up file
                fs.unlinkSync(stateFile);
            }
        }
        catch (e) {
            // Corrupt file, ignore/delete
            try {
                fs.unlinkSync(stateFile);
            }
            catch (e2) { }
        }
    }
    const now = Date.now();
    const newWakeTime = now + (seconds * 1000);
    if (activeSleep) {
        const remainingExisting = activeSleep.wakeTime - now;
        const remainingNew = seconds * 1000;
        // "Choose the shorter of the two"
        if (remainingNew < remainingExisting) {
            // New sleep is shorter, replace the old one
            try {
                process.kill(activeSleep.pid, 'SIGTERM');
            }
            catch (e) {
                // Ignore if already gone
            }
            // Proceed to start new one below
        }
        else {
            // Existing sleep is shorter (or equal), keep it
            const remainingSec = Math.ceil(remainingExisting / 1000);
            return {
                content: [{
                        type: 'text',
                        text: `Ignoring request for ${seconds}s sleep${recurring ? ' (recurring)' : ''}. An existing ${activeSleep.recurring ? 'recurring ' : ''}sleep is active and ends sooner (in ~${remainingSec}s).`
                    }],
            };
        }
    }
    const id = getNextId();
    try {
        const subprocess = spawn(process.execPath, [SLEEP_WORKER_SCRIPT, seconds.toString(), id, (!!recurring).toString(), stateFile], {
            detached: true,
            stdio: 'ignore',
            cwd: __dirname
        });
        subprocess.unref();
        // Write state file
        fs.writeFileSync(stateFile, JSON.stringify({
            pid: subprocess.pid,
            wakeTime: newWakeTime,
            recurring: !!recurring,
            interval: seconds
        }));
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to schedule sleep [${id}]: ${err}` }],
            isError: true,
        };
    }
    return {
        content: [{ type: 'text', text: `Sleep background task [${id}] started. Will sleep for ${seconds} seconds${recurring ? ' (recurring)' : ''} and notify upon completion.${activeSleep ? ' (Replaced previous longer sleep)' : ''}` }],
    };
});
server.registerTool('watch_log', {
    description: 'Monitors a log file and wakes the system up when it changes or matches a regex.',
    inputSchema: z.object({
        file_path: z.string().describe('Absolute path to the log file to watch.'),
        regex: z.string().optional().describe('Regex pattern to match against new log content. If provided, wakes only on match.'),
        wake_on_change: z.boolean().optional().describe('If true (and no regex), wakes on any file change. Defaults to true if regex is missing.'),
        timeout_sec: z.number().int().positive().optional().describe('Maximum time in seconds to watch. Defaults to 3600 (1 hour).'),
    }),
}, async ({ file_path, regex, wake_on_change, timeout_sec }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    if (!fs.existsSync(file_path)) {
        return {
            content: [{ type: 'text', text: `Error: File '${file_path}' does not exist.` }],
            isError: true,
        };
    }
    const resolvedPath = path.resolve(file_path);
    const id = getNextId();
    // Default wake_on_change to true if regex is not provided
    const effectiveWakeOnChange = wake_on_change ?? (regex === undefined);
    const encodedRegex = regex ? Buffer.from(regex).toString('base64') : '';
    const timeout = timeout_sec || 3600;
    try {
        const subprocess = spawn(process.execPath, [WATCH_WORKER_SCRIPT, resolvedPath, encodedRegex, effectiveWakeOnChange.toString(), timeout.toString(), id], {
            detached: true,
            stdio: 'ignore',
            cwd: __dirname
        });
        subprocess.unref();
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to schedule watch [${id}]: ${err}` }],
            isError: true,
        };
    }
    return {
        content: [{ type: 'text', text: `Log monitor background task [${id}] started for ${resolvedPath} (Timeout: ${timeout}s). Will notify upon match/change.` }],
    };
});
server.registerTool('cancel_watch', {
    description: 'Cancels active log watchers. Can cancel all watchers or only those for a specific file.',
    inputSchema: z.object({
        file_path: z.string().optional().describe('The file path to stop watching. If omitted, cancels ALL watchers.'),
    }),
}, async ({ file_path }) => {
    try {
        if (!fs.existsSync(PID_DIR)) {
            return { content: [{ type: 'text', text: `No active watchers found.` }] };
        }
        const files = fs.readdirSync(PID_DIR);
        let cancelledCount = 0;
        let errors = [];
        // If file_path is provided, calculate its hex signature from resolved path
        const targetHex = file_path ? Buffer.from(path.resolve(file_path)).toString('hex') : null;
        for (const file of files) {
            // Check if it looks like our pid file: watch_<hex>_<pid>.pid
            const match = file.match(/^watch_([0-9a-f]+)_(\d+)\.pid$/);
            if (!match)
                continue;
            const [_, hex, pidStr] = match;
            // Filter by path if requested
            if (targetHex && hex !== targetHex)
                continue;
            const pid = parseInt(pidStr, 10);
            try {
                // Check if process exists (signal 0)
                process.kill(pid, 0);
                // Kill it with SIGTERM (delayed_watch handles this and cleans up)
                process.kill(pid, 'SIGTERM');
                cancelledCount++;
                // Give it a tiny moment to clean up? No, proceed. 
                // We'll optimistically unlink the file to ensure the list is clean, 
                // knowing the process tries to unlink it too. Race condition is harmless here (ENOENT).
                try {
                    fs.unlinkSync(path.join(PID_DIR, file));
                }
                catch (e) { }
            }
            catch (e) {
                // ESRCH means process doesn't exist (stale pid file)
                if (e.code === 'ESRCH') {
                    // Clean up stale file
                    try {
                        fs.unlinkSync(path.join(PID_DIR, file));
                    }
                    catch (e) { }
                }
                else {
                    errors.push(e.message || String(e));
                }
            }
        }
        if (cancelledCount > 0) {
            return { content: [{ type: 'text', text: `Successfully cancelled ${cancelledCount} watcher(s)${file_path ? ' for ' + file_path : ''}.` }] };
        }
        else if (errors.length > 0) {
            return { content: [{ type: 'text', text: `Failed to cancel some watchers: ${errors.join(', ')}` }], isError: true };
        }
        else {
            return { content: [{ type: 'text', text: `No active watchers found${file_path ? ' for ' + file_path : ''}.` }] };
        }
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to cancel watchers: ${err.message || String(err)}` }],
            isError: true,
        };
    }
});
server.registerTool('yield_turn', {
    description: 'Sends a Ctl-C followed by two Enters to the gemini tmux session. Use this to end your turn and await results from a self-command or run-long-command. CRITICAL: Do not call any other tools in the same turn as this tool.',
    inputSchema: z.object({}),
}, async () => {
    // Check if we are in the correct tmux session BEFORE starting
    if (!isInsideTmuxSession()) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: Not running inside tmux session '${SESSION_NAME}'.`,
                },
            ],
            isError: true,
        };
    }
    const id = getNextId();
    try {
        const subprocess = spawn(process.execPath, [YIELD_WORKER_SCRIPT, id], {
            detached: true,
            stdio: 'ignore',
            cwd: __dirname
        });
        subprocess.unref();
    }
    catch (err) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Failed to schedule yield action [${id}]: ${err}`,
                },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Yielding turn [${id}]. Sending Ctl-C and Enters in ~3 seconds.`,
            },
        ],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);
