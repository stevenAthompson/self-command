/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import { SESSION_NAME, waitForStability } from './tmux_utils.js';

import * as fs from 'fs';

async function main() {
  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // AGGRESSIVE YIELD: Wait only 500ms to allow the tool to return, then interrupt immediately.
  // We explicitly IGNORE screen stability to prevent the agent from chaining commands.
  await delay(500);

  try {
    // 1. Send Ctrl-C to interrupt any current command or clear line
    execSync(`tmux send-keys -t ${target} C-c`);
    await delay(200);

    // 2. Send Enter twice
    execSync(`tmux send-keys -t ${target} Enter`);
    await delay(200);
    execSync(`tmux send-keys -t ${target} Enter`);
    
  } catch (error: any) {
    fs.writeFileSync('/tmp/yield_debug.log', `Error: ${error.message}\n`);
    // Silently fail in detached mode
    process.exit(1);
  }
}

main();
