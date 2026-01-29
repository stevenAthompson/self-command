/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { execSync } from 'child_process';
import { SESSION_NAME, waitForStability, sendNotification } from './tmux_utils.js';
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        process.exit(1);
    }
    const encodedCommand = args[0];
    const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Initial wait to allow immediate churn to settle
    await delay(1000);
    try {
        // 0. Ensure screen is stable BEFORE typing (Safety check)
        await waitForStability(target, 30000, 1000, 300000);
        // 1. Reset state
        execSync(`tmux send-keys -t ${target} Escape`);
        await delay(100);
        execSync(`tmux send-keys -t ${target} C-u`);
        await delay(200);
        // 2. Type the message
        for (const char of command) {
            const escapedChar = char === "'" ? "'\\\'" : char;
            execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
            await delay(20);
        }
        // 3. Submit
        await delay(500);
        execSync(`tmux send-keys -t ${target} Enter`);
        // 4. Monitor for completion
        // Wait for the command output to finish.
        // CHANGED: 30 seconds of stability required to consider "complete".
        await waitForStability(target, 30000, 1000, 600000); // 10 min timeout
        // 5. Send notification
        await sendNotification(target, "[SYSTEM COMMAND] Command complete. Resume.");
    }
    catch (error) {
        process.exit(1);
    }
}
main();
