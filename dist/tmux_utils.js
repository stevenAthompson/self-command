/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */
import { execSync } from 'child_process';
import { FileLock } from './file_lock.js';
export const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';
/**
 * Checks if the current environment is running inside the 'gemini-cli' tmux session.
 * @returns {boolean} True if the session exists and we are inside it, false otherwise.
 */
export function isInsideTmuxSession() {
    // 1. Check if the TMUX environment variable is set (indicates we are in a tmux client)
    if (!process.env.TMUX) {
        return false;
    }
    try {
        // 2. Query tmux for the current session name
        const currentSessionName = execSync('tmux display-message -p "#S"', { encoding: 'utf-8' }).trim();
        return currentSessionName === SESSION_NAME;
    }
    catch (error) {
        // If tmux command fails, assume not in a valid session
        return false;
    }
}
/**
 * Waits for the tmux pane to become stable (no content changes) for a specified duration.
 * @param target The tmux target (e.g. "session:0.0")
 * @param stableDurationMs How long the content must remain unchanged to be considered stable.
 * @param pollingIntervalMs How often to check.
 * @param timeoutMs Maximum time to wait before giving up.
 * @returns {Promise<boolean>} True if stable, false if timed out.
 */
export async function waitForStability(target, stableDurationMs = 10000, pollingIntervalMs = 1000, timeoutMs = 300000) {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const requiredChecks = Math.ceil(stableDurationMs / pollingIntervalMs);
    let lastContent = '';
    let stableChecks = 0;
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        await delay(pollingIntervalMs);
        let currentContent = '';
        try {
            // Capture the full pane content
            const textContent = execSync(`tmux capture-pane -p -t ${target}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
            // Capture cursor position to detect movement (which text capture misses)
            const cursorPosition = execSync(`tmux display-message -p -t ${target} "#{cursor_x},#{cursor_y}"`, { encoding: 'utf-8' }).trim();
            // Combine both for the stability signature
            currentContent = `${textContent}\n__CURSOR__:${cursorPosition}`;
        }
        catch (e) {
            continue;
        }
        if (currentContent === lastContent) {
            stableChecks++;
        }
        else {
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
 * Serialized via file lock to prevent garbled output.
 * @param target The tmux target.
 * @param message The message to send.
 * @param skipStabilityCheck If true, skips the stability check. Use only if caller just verified stability.
 */
export async function sendNotification(target, message, skipStabilityCheck = false) {
    // Use a longer timeout (10 minutes) for the lock to accommodate waitForStability
    const lock = new FileLock('gemini-tmux-notification', 500, 1200);
    if (await lock.acquire()) {
        try {
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            // Ensure stability before notifying (don't interrupt typing)
            if (!skipStabilityCheck) {
                await waitForStability(target, 10000, 1000, 300000);
            }
            // Clear input
            try {
                execSync(`tmux send-keys -t ${target} Escape`);
                await delay(100);
                execSync(`tmux send-keys -t ${target} C-u`);
                await delay(200);
                for (const char of message) {
                    const escapedChar = char === "'" ? "'\\''" : char;
                    execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
                    await delay(20);
                }
                await delay(500);
                execSync(`tmux send-keys -t ${target} Enter`);
            }
            catch (e) {
                // Ignore errors if tmux is gone
                console.error(`Failed to notify Gemini via tmux: ${e}`);
            }
        }
        finally {
            lock.release();
        }
    }
    else {
        console.error('Failed to acquire lock for notification (timeout).');
    }
}
/**
 * Sends keys to a specific tmux target.
 * @param target The tmux target (e.g. "session:0.0", "%1").
 * @param keys The keys string to send.
 */
export function sendKeys(target, keys) {
    // Escape single quotes in the keys string to prevent shell injection/breaking
    const escapedKeys = keys.replace(/'/g, "'\\''");
    execSync(`tmux send-keys -t ${target} '${escapedKeys}'`);
}
/**
 * Captures the content of a tmux pane.
 * @param target The tmux target.
 * @param lines Optional: Number of lines to capture (from the bottom).
 * @returns {string} The captured text.
 */
export function capturePane(target, lines) {
    const args = ['capture-pane', '-p', '-t', target];
    if (lines) {
        args.push('-S', `-${lines}`);
    }
    // execSync returns a Buffer, we decode it.
    // Use spawnSync here to handle arguments safer than template literal for execSync
    // Actually, execSync is fine if we are careful, but let's stick to the pattern or just execSync with escaping if simple.
    // Given the simplicity, direct execSync with careful construction is okay, but `child_process.execSync` takes a command string.
    // Let's use the existing execSync import but construct the command carefully.
    // For capture-pane, arguments are flags.
    let cmd = `tmux capture-pane -p -t ${target}`;
    if (lines) {
        cmd += ` -S -${lines}`;
    }
    return execSync(cmd, { encoding: 'utf-8' });
}
/**
 * Splits the window and optionally runs a command.
 * @param command Optional command to run in the new pane.
 * @param direction 'vertical' (split top/bottom) or 'horizontal' (split left/right). Default is vertical.
 * @returns {string} The ID of the new pane (e.g. "%2").
 */
export function splitWindow(command, direction = 'vertical') {
    let cmd = 'tmux split-window -P -F "#{pane_id}"';
    if (direction === 'horizontal') {
        cmd += ' -h';
    }
    else {
        cmd += ' -v';
    }
    if (command) {
        // We need to pass the command as an argument. 
        // We'll wrap it in single quotes and escape existing single quotes.
        const escapedCommand = command.replace(/'/g, "'\\''");
        cmd += ` '${escapedCommand}'`;
    }
    const paneId = execSync(cmd, { encoding: 'utf-8' }).trim();
    return paneId;
}
/**
 * Kills a specific tmux pane.
 * @param target The tmux target (e.g. "%1").
 */
export function killPane(target) {
    execSync(`tmux kill-pane -t ${target}`);
}
