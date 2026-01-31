/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import { SESSION_NAME, waitForStability, sendNotification } from './tmux_utils.js';
import { FileLock } from './file_lock.js';

import * as fs from 'fs';

async function main() {
  const args = process.argv.slice(2);
  const id = args[0] || '????';
  
  // Try to acquire lock. If busy, assume a command is running and do NOT interrupt.
  // 0 retries.
  const lock = new FileLock('gemini_tmux_input', 100, 1); 

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Small delay to allow MCP response to reach the client
  // And to allow delayed_submit to grab the lock if valid.
  await delay(2000);

  if (!await lock.acquire()) {
    // Lock busy, skipping yield to prevent interruption.
    process.exit(0);
  }

  try {
    const target = `${SESSION_NAME}:0.0`;

    // 1. Send C-c
    execSync(`tmux send-keys -t ${target} C-c`);
    await delay(300);
    // 2. Send Enters
    execSync(`tmux send-keys -t ${target} Enter`);
    await delay(300);
    execSync(`tmux send-keys -t ${target} Enter`);
  } catch (error) {
    process.exit(1);
  } finally {
    lock.release();
  }
}

main();
