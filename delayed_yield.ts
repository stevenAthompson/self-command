/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';

const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';

async function main() {
  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Wait 3 seconds before starting to ensure the agent has finished its turn
  await delay(3000);

  try {
    // 1. Send Ctrl-C to interrupt any current command or clear line
    execSync(`tmux send-keys -t ${target} C-c`);
    await delay(200);

    // 2. Send Enter twice
    execSync(`tmux send-keys -t ${target} Enter`);
    await delay(200);
    execSync(`tmux send-keys -t ${target} Enter`);
    
  } catch (error) {
    // Silently fail in detached mode
    process.exit(1);
  }
}

main();
