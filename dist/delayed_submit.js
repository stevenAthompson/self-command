/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */
import { execSync } from 'child_process';
const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: node delayed_submit.js <base64_encoded_command>');
        process.exit(1);
    }
    const encodedCommand = args[0];
    const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // console.log(`[Detached] Waiting 3 seconds before sending command...`);
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
    }
    catch (error) {
        // Silently fail or log to a file if needed, since we are detached
        // console.error(`[Detached] Failed: ${error}`);
        process.exit(1);
    }
}
main();
