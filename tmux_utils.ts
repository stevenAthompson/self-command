/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';

export const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';

/**
 * Waits for the tmux pane to become stable (no content changes) for a specified duration.
 * @param target The tmux target (e.g. "session:0.0")
 * @param stableDurationMs How long the content must remain unchanged to be considered stable.
 * @param pollingIntervalMs How often to check.
 * @param timeoutMs Maximum time to wait before giving up.
 * @returns {Promise<boolean>} True if stable, false if timed out.
 */
export async function waitForStability(target: string, stableDurationMs: number = 30000, pollingIntervalMs: number = 1000, timeoutMs: number = 300000): Promise<boolean> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const requiredChecks = Math.ceil(stableDurationMs / pollingIntervalMs);
    
    let lastContent = '';
    let stableChecks = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        await delay(pollingIntervalMs);
        
        let currentContent = '';
        try {
            // Capture the full pane to detect any changes
            currentContent = execSync(`tmux capture-pane -p -t ${target}`, { encoding: 'utf-8' });
        } catch (e) {
            continue;
        }

        if (currentContent === lastContent) {
            stableChecks++;
        } else {
            stableChecks = 0;
            lastContent = currentContent;
        }

        if (stableChecks >= requiredChecks) {
            return true; // Stable
        }
    }
    return false; // Timed out
}

/**
 * Sends a notification to the tmux pane.
 * Safely waits for a brief moment of stability before typing to avoid interruption.
 */
export async function sendNotification(target: string, message: string) {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Ensure stability before notifying (don't interrupt typing)
    await waitForStability(target, 30000, 1000, 300000);

    // Clear input
    try {
        execSync(`tmux send-keys -t ${target} Escape`);
        await delay(100);
        execSync(`tmux send-keys -t ${target} C-u`);
        await delay(200);

        for (const char of message) {
            const escapedChar = char === "'" ? "'\\\'" : char;
            execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
            await delay(20);
        }
        await delay(500);
        execSync(`tmux send-keys -t ${target} Enter`);
    } catch (e) {
        // Ignore errors if tmux is gone
    }
}
