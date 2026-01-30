/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { SESSION_NAME, sendNotification } from './tmux_utils.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PID_DIR = path.join(__dirname, 'pids');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    process.exit(1);
  }

  const filePath = args[0];
  // arg[1] is base64 regex or empty string
  const encodedRegex = args[1] || '';
  const regexString = encodedRegex ? Buffer.from(encodedRegex, 'base64').toString('utf-8') : null;
  
  // arg[2] is wake_on_change ("true"/"false")
  const wakeOnChange = args[2] === 'true';

  // arg[3] is timeout in seconds
  const timeoutSec = parseInt(args[3] || '3600', 10);
  const id = args[4] || '????';
  const timeoutMs = timeoutSec * 1000;
  const startTime = Date.now();

  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- PID File Management ---
  if (!fs.existsSync(PID_DIR)) {
    try { fs.mkdirSync(PID_DIR, { recursive: true }); } catch (e) {}
  }
  
  const pathHex = Buffer.from(filePath).toString('hex');
  const pidFile = path.join(PID_DIR, `watch_${pathHex}_${process.pid}.pid`);

  const cleanup = () => {
    try {
        if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
        }
    } catch (e) {}
  };

  try {
    fs.writeFileSync(pidFile, process.pid.toString());
  } catch (e) {
      // Proceed even if we can't write the PID file
  }

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  // ---------------------------

  if (!fs.existsSync(filePath)) {
    // Fail if file doesn't exist
    process.exit(1);
  }

  let lastSize = fs.statSync(filePath).size;
  let regex: RegExp | null = null;
  if (regexString) {
      try {
          regex = new RegExp(regexString);
      } catch (e) {
          process.exit(1);
      }
  }

  // Polling loop
  while (true) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
        process.exit(0); // Timed out silently? Or should notify? Silently is probably better to avoid noise.
    }

    await delay(1000);

    try {
        if (!fs.existsSync(filePath)) {
            // File deleted? Wait or exit? Exit seems safer.
             process.exit(1);
        }

        const stats = fs.statSync(filePath);
        const currentSize = stats.size;

        if (currentSize > lastSize) {
            // File grew
            if (regex) {
                // Read new content
                const stream = fs.createReadStream(filePath, {
                    start: lastSize,
                    end: currentSize - 1,
                    encoding: 'utf-8'
                });
                
                let newContent = '';
                for await (const chunk of stream) {
                    newContent += chunk;
                }

                if (regex.test(newContent)) {
                    await sendNotification(target, `[${id}] Log matched regex "${regexString}". Waking up.`);
                    process.exit(0);
                }
            } else if (wakeOnChange) {
                 await sendNotification(target, `[${id}] Log changed. Waking up.`);
                 process.exit(0);
            }
            lastSize = currentSize;
        } else if (currentSize < lastSize) {
            // Truncated
            lastSize = currentSize;
        }
    } catch (e) {
        // Ignore transient errors
    }
  }
}

main();
