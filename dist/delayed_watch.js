/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { SESSION_NAME, sendNotification } from './tmux_utils.js';
import * as fs from 'fs';
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
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    if (!fs.existsSync(filePath)) {
        // Fail if file doesn't exist
        process.exit(1);
    }
    let lastSize = fs.statSync(filePath).size;
    let regex = null;
    if (regexString) {
        try {
            regex = new RegExp(regexString);
        }
        catch (e) {
            process.exit(1);
        }
    }
    // Polling loop
    while (true) {
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
                        await sendNotification(target, `[SYSTEM WATCH] Log matched regex "${regexString}". Waking up.`);
                        process.exit(0);
                    }
                }
                else if (wakeOnChange) {
                    await sendNotification(target, `[SYSTEM WATCH] Log changed. Waking up.`);
                    process.exit(0);
                }
                lastSize = currentSize;
            }
            else if (currentSize < lastSize) {
                // Truncated
                lastSize = currentSize;
            }
        }
        catch (e) {
            // Ignore transient errors
        }
    }
}
main();
