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
    const id = args[1] || '????';
    const target = `${SESSION_NAME}:0.0`;
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    await sendNotification(target, `[${id}] Sleep complete. Waking up.`);
}
main();
