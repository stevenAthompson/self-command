import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
export class FileLock {
    lockFilePath;
    retryInterval;
    maxRetries;
    constructor(lockName, retryInterval = 100, maxRetries = 600) {
        const tmpDir = os.tmpdir();
        this.lockFilePath = path.join(tmpDir, `${lockName}.lock`);
        this.retryInterval = retryInterval;
        this.maxRetries = maxRetries;
    }
    async acquire() {
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                // 'wx' flag fails if file exists
                const fd = fs.openSync(this.lockFilePath, 'wx');
                // Add PID to lock file for debugging and stale check
                fs.writeSync(fd, process.pid.toString());
                fs.closeSync(fd);
                return true;
            }
            catch (e) {
                if (e.code === 'EEXIST') {
                    // Check for stale lock
                    try {
                        const pid = parseInt(fs.readFileSync(this.lockFilePath, 'utf-8'), 10);
                        if (!isNaN(pid)) {
                            try {
                                process.kill(pid, 0); // Check if process exists
                            }
                            catch (err) {
                                if (err.code === 'ESRCH') {
                                    // Process dead, remove stale lock
                                    try {
                                        fs.unlinkSync(this.lockFilePath);
                                    }
                                    catch (ignore) { }
                                    continue; // Retry immediately
                                }
                            }
                        }
                    }
                    catch (err) {
                        // Ignore read errors, maybe it was just deleted
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, this.retryInterval));
                }
                else {
                    throw e;
                }
            }
        }
        return false;
    }
    release() {
        try {
            if (fs.existsSync(this.lockFilePath)) {
                // Only delete if we own it? 
                // Simplified: Just delete. The cooperative nature assumes good faith.
                fs.unlinkSync(this.lockFilePath);
            }
        }
        catch (e) {
            // Ignore errors on release
        }
    }
    // Static helper for easy use
    static async withLock(lockName, action) {
        const lock = new FileLock(lockName);
        if (await lock.acquire()) {
            try {
                return await action();
            }
            finally {
                lock.release();
            }
        }
        else {
            throw new Error(`Failed to acquire lock: ${lockName}`);
        }
    }
}
