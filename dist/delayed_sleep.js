/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { SESSION_NAME, sendNotification } from './tmux_utils.js';
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        process.exit(1);
    }
    const seconds = parseInt(args[0], 10);
    if (isNaN(seconds)) {
        process.exit(1);
    }
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Sleep for the specified duration
    await delay(seconds * 1000);
    try {
        // Notify
        await sendNotification(target, "[SYSTEM SLEEP] Sleep complete. Waking up.");
    }
    catch (error) {
        process.exit(1);
    }
}
main();
