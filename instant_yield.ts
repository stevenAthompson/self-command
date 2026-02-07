/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import { SESSION_NAME } from './tmux_utils.js';

async function main() {
  const args = process.argv.slice(2);
  // const id = args[0] || '????'; // ID unused in force mode

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Minimal delay to ensure detached process logic settles, but effectively immediate.
  await delay(50);

  try {
    const target = `${SESSION_NAME}:0.0`;

    // 0. Send Escape a few times to clear any partial input or modes
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);

    // 1. Send C-c immediately
    execSync(`tmux send-keys -t ${target} C-c`);
    await delay(100);
    // 2. Send Enters
    execSync(`tmux send-keys -t ${target} Enter`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} Enter`);
  } catch (error) {
    process.exit(1);
  }
}

main();
