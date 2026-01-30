/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync, spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

// Import shared utilities
import { isInsideTmuxSession, sendNotification, SESSION_NAME } from './tmux_utils.js';

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

/**
 * Generates a unique ID for request tracking.
 * Uses a short timestamp based string.
 */
function getNextId(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

server.registerTool(
  'self_command',
  {
    description: 'Sends a command to the Gemini CLI via tmux. Returns immediately, waits for the command to execute and the session to stabilize, and then sends a completion notification.',
    inputSchema: z.object({
      command: z.string().describe('The command to send to Gemini (e.g., "help", "list files").'),
    }),
  },
  async ({ command }) => {
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
    } catch (err) {
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
          text: `Background task [${id}] started. Will execute "${command}" in ~3 seconds and notify upon completion.`, 
        },
      ],
    };
  },
);

server.registerTool(
  'run_long_command',
  {
    description: 'Executes a long-running shell command in the background and notifies Gemini when finished.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute.'),
    }),
  },
  async ({ command }) => {
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
    });

    child.on('error', async (err) => {
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
    });

    return {
      content: [
        {
          type: 'text',
          text: `Command [${id}] "${command}" started in the background (PID: ${child.pid}, CWD: ${process.cwd()}). I will notify you when it finishes.`, 
        },
      ],
    };
  },
);

server.registerTool(
  'gemini_sleep',
  {
    description: 'Sleeps for a specified number of seconds and then sends a tmux message to wake the system up. Useful for waiting for long-running background tasks.',
    inputSchema: z.object({
      seconds: z.number().positive().describe('Number of seconds to sleep.'),
    }),
  },
  async ({ seconds }) => {
    if (!isInsideTmuxSession()) {
      return {
        content: [{ type: 'text', text: `Error: Not running inside tmux session '${SESSION_NAME}'.` }],
        isError: true,
      };
    }

    const id = getNextId();
    try {
      const subprocess = spawn(process.execPath, [SLEEP_WORKER_SCRIPT, seconds.toString(), id], {
        detached: true,
        stdio: 'ignore',
        cwd: __dirname
      });
      subprocess.unref();
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to schedule sleep [${id}]: ${err}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: `Sleep background task [${id}] started. Will sleep for ${seconds} seconds and notify upon completion.` }],
    };
  },
);

server.registerTool(
  'watch_log',
  {
    description: 'Monitors a log file and wakes the system up when it changes or matches a regex.',
    inputSchema: z.object({
      file_path: z.string().describe('Absolute path to the log file to watch.'),
      regex: z.string().optional().describe('Regex pattern to match against new log content. If provided, wakes only on match.'),
      wake_on_change: z.boolean().optional().describe('If true (and no regex), wakes on any file change. Defaults to true if regex is missing.'),
      timeout_sec: z.number().int().positive().optional().describe('Maximum time in seconds to watch. Defaults to 3600 (1 hour).'),
    }),
  },
  async ({ file_path, regex, wake_on_change, timeout_sec }) => {
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

    const id = getNextId();
    // Default wake_on_change to true if regex is not provided
    const effectiveWakeOnChange = wake_on_change ?? (regex === undefined);
    const encodedRegex = regex ? Buffer.from(regex).toString('base64') : '';
    const timeout = timeout_sec || 3600;

    try {
      const subprocess = spawn(process.execPath, [WATCH_WORKER_SCRIPT, file_path, encodedRegex, effectiveWakeOnChange.toString(), timeout.toString(), id], {
        detached: true,
        stdio: 'ignore',
        cwd: __dirname
      });
      subprocess.unref();
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to schedule watch [${id}]: ${err}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: `Log monitor background task [${id}] started for ${file_path} (Timeout: ${timeout}s). Will notify upon match/change.` }],
    };
  },
);

server.registerTool(
  'cancel_watch',
  {
    description: 'Cancels active log watchers. Can cancel all watchers or only those for a specific file.',
    inputSchema: z.object({
      file_path: z.string().optional().describe('The file path to stop watching. If omitted, cancels ALL watchers.'),
    }),
  },
  async ({ file_path }) => {
    try {
      const args = ['-f'];
      if (file_path) {
        // Match specific file path argument
        args.push(`delayed_watch.js ${file_path}`);
      } else {
        args.push('delayed_watch.js');
      }
      
      const result = spawnSync('pkill', args);
      
      if (result.status === 0) {
         return {
          content: [{ type: 'text', text: `Successfully cancelled watcher(s)${file_path ? ' for ' + file_path : ''}.` }],
        };
      } else if (result.status === 1) {
         // pkill returns 1 if no processes matched
         return {
            content: [{ type: 'text', text: `No active watchers found${file_path ? ' for ' + file_path : ''}.` }],
         };
      } else {
         throw new Error(`pkill failed with status ${result.status}: ${result.stderr.toString()}`);
      }
    } catch (err) {
       return {
        content: [{ type: 'text', text: `Failed to cancel watchers: ${err}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'yield_turn',
  {
    description: 'Sends a Ctl-C followed by two Enters to the gemini tmux session. Use this to end your turn and await results from a self-command or run-long-command. CRITICAL: Do not call any other tools in the same turn as this tool.',
    inputSchema: z.object({}),
  },
  async () => {
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
    } catch (err) {
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
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);