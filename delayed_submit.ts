/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';

const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';

/**
 * Waits for the tmux pane to become stable (no content changes) for a specified duration.
 * @param target The tmux target (e.g. "session:0.0")
 * @param stableDurationMs How long the content must remain unchanged to be considered stable.
 * @param pollingIntervalMs How often to check.
 * @param timeoutMs Maximum time to wait before giving up.
 * @returns {Promise<boolean>} True if stable, false if timed out.
 */
async function waitForStability(target: string, stableDurationMs: number = 3000, pollingIntervalMs: number = 1000, timeoutMs: number = 300000): Promise<boolean> {
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    process.exit(1);
  }

  const encodedCommand = args[0];
  const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');

  const target = `${SESSION_NAME}:0.0`;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Initial wait to allow immediate churn to settle (e.g. from the agent's yield)
  await delay(1000);

  try {
    // 0. Ensure screen is stable BEFORE typing (Safety check)
    // We wait for ~2 seconds of stability before starting input to prevent typing over active output
    await waitForStability(target, 2000, 500, 30000);

    // 1. Reset state: Send Escape and Ctrl-u to clear any existing input
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // 2. Type the message character by character (slow-typing technique)
    for (const char of command) {
      // Escape special characters for shell/tmux
      const escapedChar = char === "'" ? "'\\\'" : char;
      execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
      await delay(20);
    }

    // 3. Submit with Enter
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);

    // 4. Monitor for completion
    // Wait for the command output to finish (stability check)
    // We assume completion when the screen stops changing for 3 seconds
    await waitForStability(target, 3000, 1000, 300000);

    // 5. Send notification
    // Verify stability again briefly to ensure we don't interrupt a late-arriving log (though step 4 should cover it)
    await waitForStability(target, 1000, 500, 5000);

    const notification = "[SYSTEM COMMAND] Command complete. Resume.";
    
    // Clear input again just in case
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    for (const char of notification) {
        const escapedChar = char === "'" ? "'\\\'" : char;
        execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
        await delay(20);
    }
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);
    
  } catch (error) {
    // Silently fail in detached mode
    process.exit(1);
  }
}

main();