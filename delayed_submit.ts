/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import { SESSION_NAME, waitForStability, sendNotification } from './tmux_utils.js';
import { FileLock } from './file_lock.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    process.exit(1);
  }

  const encodedCommand = args[0];
  const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');
  const id = args[1] || '????';

  const lock = new FileLock('gemini_tmux_input', 500, 1200); // Wait up to 10 minutes

  if (!await lock.acquire()) {
    // Failed to acquire lock
    process.exit(1);
  }

  try {
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Initial wait to allow immediate churn to settle
    await delay(1000);

    // 0. Ensure screen is stable BEFORE typing (Safety check)
    await waitForStability(target, 10000, 1000, 300000);

    // 1. Reset state
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // 2. Type the message
    for (const char of command) {
      const escapedChar = char === "'" ? "'\\''" : char;
      execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
      await delay(20);
    }

    // 3. Submit
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);

    // 4. Monitor for completion
    // Wait for the command output to finish.
    // CHANGED: 10 seconds of stability required to consider "complete".
    await waitForStability(target, 10000, 1000, 600000); // 10 min timeout

    // 5. Send notification
    // We skip the stability check inside sendNotification because we JUST verified it above.
    await sendNotification(target, `[${id}] Self Command Complete`, true);
    
  } catch (error) {
    process.exit(1);
  } finally {
    lock.release();
  }
}

main();