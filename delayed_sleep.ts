/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { SESSION_NAME, sendNotification } from './tmux_utils.js';
import * as fs from 'fs';

interface SleepState {
  pid: number;
  wakeTime: number;
  recurring: boolean;
  interval: number;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    process.exit(1);
  }

  const seconds = parseInt(args[0], 10);
  const id = args[1];
  // args[2] is 'true'/'false' for recurring
  const isRecurring = args[2] === 'true';
  // args[3] is the path to the state file
  const stateFilePath = args[3];

  const target = `${SESSION_NAME}:0.0`;

  if (isRecurring) {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      await sendNotification(target, `[${id}] Recurring sleep interval (${seconds}s) reached. Waking up.`);
      
      // Update state file with next wake time
      if (stateFilePath && fs.existsSync(stateFilePath)) {
        try {
          const nextWake = Date.now() + (seconds * 1000);
          const state: SleepState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
          state.wakeTime = nextWake;
          fs.writeFileSync(stateFilePath, JSON.stringify(state));
        } catch (e) {
          // Ignore errors updating state file
        }
      }
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    await sendNotification(target, `[${id}] Sleep complete. Waking up.`);
    
    // Clean up state file
    if (stateFilePath && fs.existsSync(stateFilePath)) {
      try {
        fs.unlinkSync(stateFilePath);
      } catch (e) {
        // Ignore
      }
    }
  }
}

main();
