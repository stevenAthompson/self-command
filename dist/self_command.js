/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';
/**
 * Checks if the current environment is running inside the 'gemini-cli' tmux session.
 * @returns {boolean} True if the session exists and we are inside it, false otherwise.
 */
function isInsideTmuxSession() {
    // 1. Check if the TMUX environment variable is set (indicates we are in a tmux client)
    if (!process.env.TMUX) {
        return false;
    }
    try {
        // 2. Query tmux for the current session name
        const currentSessionName = execSync('tmux display-message -p "#S"', { encoding: 'utf-8' }).trim();
        return currentSessionName === SESSION_NAME;
    }
    catch (error) {
        // If tmux command fails, assume not in a valid session
        return false;
    }
}
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
    // Spawn the worker script detached
    // We encode the command to base64 to avoid argument parsing issues
    const encodedCommand = Buffer.from(command).toString('base64');
    try {
        const subprocess = spawn(process.execPath, [SUBMIT_WORKER_SCRIPT, encodedCommand], {
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
                    text: `Failed to schedule command execution: ${err}`,
                },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Background task started. Will execute "${command}" in ~3 seconds and notify upon completion.`,
            },
        ],
    };
});
server.registerTool('gemini_sleep', {
    description: 'Sleeps for a specified number of seconds and then sends a tmux message to wake the system up. Useful for waiting for long-running background tasks.',
    inputSchema: z.object({
        seconds: z.number().positive().describe('Number of seconds to sleep.'),
    }),
}, async ({ seconds }) => {
    if (!isInsideTmuxSession()) {
        return {
            content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
            isError: true,
        };
    }
    try {
        const subprocess = spawn(process.execPath, [SLEEP_WORKER_SCRIPT, seconds.toString()], {
            detached: true,
            stdio: 'ignore',
            cwd: __dirname
        });
        subprocess.unref();
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to schedule sleep: ${err}` }],
            isError: true,
        };
    }
    return {
        content: [{ type: 'text', text: `Sleep background task started. Will sleep for ${seconds} seconds and notify upon completion.` }],
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
    // Default wake_on_change to true if regex is not provided
    const effectiveWakeOnChange = wake_on_change ?? (regex === undefined);
    const encodedRegex = regex ? Buffer.from(regex).toString('base64') : '';
    const timeout = timeout_sec || 3600;
    try {
        const subprocess = spawn(process.execPath, [WATCH_WORKER_SCRIPT, file_path, encodedRegex, effectiveWakeOnChange.toString(), timeout.toString()], {
            detached: true,
            stdio: 'ignore',
            cwd: __dirname
        });
        subprocess.unref();
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to schedule watch: ${err}` }],
            isError: true,
        };
    }
    return {
        content: [{ type: 'text', text: `Log monitor background task started for ${file_path} (Timeout: ${timeout}s). Will notify upon match/change.` }],
    };
});
server.registerTool('cancel_watch', {
    description: 'Cancels active log watchers. Can cancel all watchers or only those for a specific file.',
    inputSchema: z.object({
        file_path: z.string().optional().describe('The file path to stop watching. If omitted, cancels ALL watchers.'),
    }),
}, async ({ file_path }) => {
    try {
        let command = 'pkill -f "delayed_watch.js"';
        if (file_path) {
            // Match specific file path argument
            command = `pkill -f "delayed_watch.js ${file_path}"`;
        }
        try {
            execSync(command);
            return {
                content: [{ type: 'text', text: `Successfully cancelled watcher(s)${file_path ? ' for ' + file_path : ''}.` }],
            };
        }
        catch (e) {
            // pkill returns exit code 1 if no processes matched
            if (e.status === 1) {
                return {
                    content: [{ type: 'text', text: `No active watchers found${file_path ? ' for ' + file_path : ''}.` }],
                };
            }
            throw e;
        }
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Failed to cancel watchers: ${err}` }],
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
    try {
        const subprocess = spawn(process.execPath, [YIELD_WORKER_SCRIPT], {
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
                    text: `Failed to schedule yield action: ${err}`,
                },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Yielding turn. Sending Ctl-C and Enters in ~3 seconds.`,
            },
        ],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);
