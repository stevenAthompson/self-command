/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { execSync } from 'child_process';
import { SESSION_NAME, sendNotification } from './tmux_utils.js';
async function main() {
    const args = process.argv.slice(2);
    const id = args[0] || '????';
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Small delay to allow MCP response to reach the client
    await delay(1000);
    try {
        // 1. Send C-c
        execSync(`tmux send-keys -t ${target} C-c`);
        await delay(100);
        // 2. Send Enters
        execSync(`tmux send-keys -t ${target} Enter`);
        await delay(100);
        execSync(`tmux send-keys -t ${target} Enter`);
        // 3. Notify
        await sendNotification(target, `[${id}] Yielding complete.`);
    }
    catch (error) {
        process.exit(1);
    }
}
main();
