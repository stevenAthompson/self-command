/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { sendNotification, SESSION_NAME } from './tmux_utils.js';
import * as fs from 'fs';

const [,, thresholdStr, durationStr, id] = process.argv;
const threshold = parseFloat(thresholdStr); // e.g. 10.0 (percent)
const duration = parseInt(durationStr, 10); // e.g. 5 (seconds)
const target = `${SESSION_NAME}:0.0`;

// Keep track of previous CPU times for calculation
let prevTotal = 0;
let prevIdle = 0;

function readCpuTimes(): { total: number, idle: number } {
    try {
        const data = fs.readFileSync('/proc/stat', 'utf8');
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.startsWith('cpu ')) {
                const parts = line.split(/\s+/);
                // parts[0] is "cpu"
                // user: parts[1], nice: parts[2], system: parts[3], idle: parts[4], iowait: parts[5], ...
                const user = parseInt(parts[1], 10);
                const nice = parseInt(parts[2], 10);
                const system = parseInt(parts[3], 10);
                const idle = parseInt(parts[4], 10);
                const iowait = parseInt(parts[5], 10);
                const irq = parseInt(parts[6], 10);
                const softirq = parseInt(parts[7], 10);
                const steal = parseInt(parts[8], 10);
                
                const total = user + nice + system + idle + iowait + irq + softirq + steal;
                return { total, idle: idle + iowait }; // Count iowait as idle? Usually "idle" is just idle, but for "system busy" iowait is busy. Let's strictly use 'idle' column.
                // Actually, standard "CPU usage" is (1 - idle_delta/total_delta).
            }
        }
    } catch (e) {
        console.error('Error reading /proc/stat:', e);
    }
    return { total: 0, idle: 0 };
}

async function getCpuUsage(): Promise<number> {
    const current = readCpuTimes();
    
    if (prevTotal === 0) {
        // First run, initialize and wait a bit
        prevTotal = current.total;
        prevIdle = current.idle;
        await new Promise(r => setTimeout(r, 500));
        return getCpuUsage();
    }

    const deltaTotal = current.total - prevTotal;
    const deltaIdle = current.idle - prevIdle;
    
    prevTotal = current.total;
    prevIdle = current.idle;

    if (deltaTotal === 0) return 0;

    const usage = 1.0 - (deltaIdle / deltaTotal);
    return usage * 100.0;
}

async function main() {
    let idleStartTime = 0;
    // Timeout safety: 1 hour max
    const startTime = Date.now();
    const timeout = 3600 * 1000; 

    while (Date.now() - startTime < timeout) {
        const usage = await getCpuUsage();
        
        if (usage < threshold) {
            if (idleStartTime === 0) {
                idleStartTime = Date.now();
            } else {
                const elapsed = (Date.now() - idleStartTime) / 1000;
                if (elapsed >= duration) {
                    // Success condition met
                    await sendNotification(target, `[${id}] System idle (CPU ${usage.toFixed(1)}% < ${threshold}%) for ${duration}s. Waking up.`);
                    process.exit(0);
                }
            }
        } else {
            // Reset if usage spikes
            idleStartTime = 0;
        }

        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Timeout reached
    await sendNotification(target, `[${id}] Wait for idle timed out after 1 hour.`);
}

main();
