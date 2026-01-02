/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync } from 'child_process';
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
const server = new McpServer({
  name: 'self-command-server',
  version: '1.0.0',
});

/**
 * Executes the delay and tmux interaction in the background.
 * @param command The command to inject into the tmux session.
 */
async function sendCommandDelayed(command: string) {
  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  console.error(`[Background] Waiting 3 seconds before sending command: "${command}"`);
  await delay(3000);

  try {
    // 1. Reset state: Send Escape and Ctrl-u to clear any existing input
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // 2. Type the message character by character (slow-typing technique)
    for (const char of command) {
      // Escape special characters for shell/tmux
      const escapedChar = char === "'" ? "'\\''" : char;
      execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
      await delay(20);
    }

    // 3. Submit with Enter
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);
    console.error(`[Background] Command sent: "${command}"`);

  } catch (error) {
    console.error(`[Background] Failed to send self-command via tmux: ${error}`);
  }
}

server.registerTool(
  'self_command',
  {
    description: 'Sends a command to the Gemini CLI itself via tmux after a short delay. Returns immediately.',
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

    // Trigger the delayed command execution WITHOUT awaiting it
    // This allows the tool to return immediately
    sendCommandDelayed(command).catch(err => {
      console.error(`[Background] Unhandled error in sendCommandDelayed: ${err}`);
    });

    return {
      content: [
        {
          type: 'text',
          text: `Command received. Will execute "${command}" in ~3 seconds.`, 
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
