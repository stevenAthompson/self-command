/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn, execSync } from 'child_process';
import { promisify } from 'util';

const SESSION_NAME = 'gemini-cli';

/**
 * Checks if the current environment is running inside the 'gemini-cli' tmux session.
 * @returns {boolean} True if the session exists, false otherwise.
 */
function isInsideTmuxSession(): boolean {
  try {
    execSync(`tmux has-session -t ${SESSION_NAME}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sends a message back to the gemini-cli tmux session.
 * @param message The message to send.
 */
async function notifyGemini(message: string) {
  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // 1. Reset state: Send Escape and Ctrl-u
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // 2. Type the message character by character (slow-typing technique)
    for (const char of message) {
      // Escape special characters for shell/tmux
      const escapedChar = char === "'" ? "'\\''" : char;
      execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
      await delay(20);
    }

    // 3. Submit with Enter
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);
  } catch (error) {
    console.error(`Failed to notify Gemini via tmux: ${error}`);
  }
}

const server = new McpServer({
  name: 'run-long-command-server',
  version: '1.0.0',
});

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

    // Spawn the background process
    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    // Set up completion handler
    child.on('close', async (code) => {
      const completionMessage = `Background command completed: "${command}" (Exit code: ${code})`;
      await notifyGemini(completionMessage);
    });

    child.on('error', async (err) => {
      const errorMessage = `Background command failed: "${command}" (Error: ${err.message})`;
      await notifyGemini(errorMessage);
    });

    return {
      content: [
        {
          type: 'text',
          text: `Command "${command}" started in the background. I will notify you when it finishes.`, 
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
