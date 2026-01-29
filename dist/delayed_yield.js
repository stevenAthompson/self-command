/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { execSync } from 'child_process';
import { SESSION_NAME, waitForStability } from './tmux_utils.js';
async function main() {
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Wait for stability before interrupting
    await waitForStability(target, 30000, 1000, 300000);
    try {
        // 1. Send Ctrl-C to interrupt any current command or clear line
        execSync(`tmux send-keys -t ${target} C-c`);
        await delay(200);
        // 2. Send Enter twice
        execSync(`tmux send-keys -t ${target} Enter`);
        await delay(200);
        execSync(`tmux send-keys -t ${target} Enter`);
    }
    catch (error) {
        // Silently fail in detached mode
        process.exit(1);
    }
}
main();
