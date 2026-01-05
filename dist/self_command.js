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
// Resolve the path to the worker script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_SCRIPT = path.join(__dirname, 'delayed_submit.js');
server.registerTool('self_command', {
    description: 'Executes a long-running shell command in the background. Returns immediately, waits for the command to complete, and then sends a notification to Gemini via tmux.',
    inputSchema: z.object({
        command: z.string().describe('The shell command to execute (e.g., "npm install", "sleep 10").'),
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
        const subprocess = spawn(process.execPath, [WORKER_SCRIPT, encodedCommand], {
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
                text: `Command received. Will execute "${command}" in ~3 seconds.`,
            },
        ],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);
