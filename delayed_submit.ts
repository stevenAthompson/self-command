/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node delayed_submit.js <base64_encoded_command>');
    process.exit(1);
  }

  const encodedCommand = args[0];
  const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');

  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // console.log(`[Detached] Waiting 3 seconds before executing command...`);
  await delay(3000);

  try {
    // 1. Execute the command (long-running)
    // We use execAsync to wait for completion
    // We could capture stdout/stderr here if we wanted to log it or send it back
    await execAsync(command);

  } catch (error) {
    // If the command fails, we might want to notify Gemini about the failure too?
    // For now, we proceed to notify completion (or maybe include error info)
    // The requirement says "upon completion... send a notice".
    console.error(`Command failed: ${error}`);
  }

  try {
    const notification = "[SYSTEM COMMAND] Command complete. Resume.";

    // 2. Reset state: Send Escape and Ctrl-u to clear any existing input
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // 3. Type the notification message
    for (const char of notification) {
      // Escape special characters for shell/tmux
      const escapedChar = char === "'" ? "'\\''" : char;
      execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
      await delay(20);
    }

    // 4. Submit with Enter
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);
    
  } catch (error) {
    process.exit(1);
  }
}

main();
