/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { execSync } from 'child_process';
const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        process.exit(1);
    }
    const encodedCommand = args[0];
    const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Wait 3 seconds before starting to ensure the previous command has cleared
    await delay(3000);
    try {
        // 1. Reset state: Send Escape and Ctrl-u to clear any existing input
        execSync(`tmux send-keys -t ${target} Escape`);
        await delay(100);
        execSync(`tmux send-keys -t ${target} C-u`);
        await delay(200);
        // 2. Type the message character by character (slow-typing technique)
        for (const char of command) {
            // Escape special characters for shell/tmux
            const escapedChar = char === "'" ? "'\\''" : char;
            execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
            await delay(20);
        }
        // 3. Submit with Enter
        await delay(500);
        execSync(`tmux send-keys -t ${target} Enter`);
        // 4. Monitor for completion
        // We poll the pane content. If it remains unchanged for stableCount checks, we assume it's done.
        let lastContent = '';
        let stableChecks = 0;
        const POLLING_INTERVAL = 1000; // Check every 1 second
        const REQUIRED_STABLE_CHECKS = 3; // Wait for 3 seconds of stability (approx)
        const MAX_WAIT_TIME = 300000; // 5 minutes max wait
        const startTime = Date.now();
        while (Date.now() - startTime < MAX_WAIT_TIME) {
            await delay(POLLING_INTERVAL);
            let currentContent = '';
            try {
                currentContent = execSync(`tmux capture-pane -p -t ${target}`, { encoding: 'utf-8' });
            }
            catch (e) {
                // If capture fails, we retry
                continue;
            }
            if (currentContent === lastContent) {
                stableChecks++;
            }
            else {
                stableChecks = 0;
                lastContent = currentContent;
            }
            if (stableChecks >= REQUIRED_STABLE_CHECKS) {
                break; // Content has been stable, assume command is done
            }
        }
        // 5. Send notification
        const notification = "[SYSTEM COMMAND] Command complete. Resume.";
        // Clear input again just in case
        execSync(`tmux send-keys -t ${target} Escape`);
        await delay(100);
        execSync(`tmux send-keys -t ${target} C-u`);
        await delay(200);
        for (const char of notification) {
            const escapedChar = char === "'" ? "'\\''" : char;
            execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
            await delay(20);
        }
        await delay(500);
        execSync(`tmux send-keys -t ${target} Enter`);
    }
    catch (error) {
        // Silently fail in detached mode
        process.exit(1);
    }
}
main();
