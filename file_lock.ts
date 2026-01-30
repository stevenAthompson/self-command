
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class FileLock {
  private lockFilePath: string;
  private retryInterval: number;
  private maxRetries: number;

  constructor(lockName: string, retryInterval: number = 100, maxRetries: number = 600) { // Default: 60s timeout
    const tmpDir = os.tmpdir();
    this.lockFilePath = path.join(tmpDir, `${lockName}.lock`);
    this.retryInterval = retryInterval;
    this.maxRetries = maxRetries;
  }

  async acquire(): Promise<boolean> {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        // 'wx' flag fails if file exists
        const fd = fs.openSync(this.lockFilePath, 'wx');
        fs.closeSync(fd);
        // Add PID to lock file for debugging
        fs.writeFileSync(this.lockFilePath, process.pid.toString());
        return true;
      } catch (e: any) {
        if (e.code === 'EEXIST') {
          // Check for stale lock (optional, but good for safety)
          // For now, just wait
          await new Promise(resolve => setTimeout(resolve, this.retryInterval));
        } else {
          throw e;
        }
      }
    }
    return false;
  }

  release(): void {
    try {
      if (fs.existsSync(this.lockFilePath)) {
          // Only delete if we own it? 
          // Simplified: Just delete. The cooperative nature assumes good faith.
          fs.unlinkSync(this.lockFilePath);
      }
    } catch (e) {
      // Ignore errors on release
    }
  }
  
  // Static helper for easy use
  static async withLock<T>(lockName: string, action: () => Promise<T>): Promise<T> {
      const lock = new FileLock(lockName);
      if (await lock.acquire()) {
          try {
              return await action();
          } finally {
              lock.release();
          }
      } else {
          throw new Error(`Failed to acquire lock: ${lockName}`);
      }
  }
}
